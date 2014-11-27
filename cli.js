#!/usr/bin/env node

require('colors');
var shell = require('shelljs');
var argv = require('minimist')(process.argv.slice(2));
var async = require('async');
var pathUtils = require('path');
var error = require('./error');
var config = require('./config');
var shellexec = require('./shellexec');
var exec = require('./exec');
var resolvePath = require('./path').resolvePath;
var addPathEnv = require('./path').addPathEnv;
var tabtab = require('tabtab');
var fs = require('fs');
var moment = require('moment');
var logfile = require('./logfile');
var serveHttp = require('./serve');
var url = require('url');
var request = require('request');

if(process.argv.slice(2)[0] === 'completion') {
  return tabtab.complete('runtime', function(err, data) {
    if(err || !data) return;

    tabtab.log([
      'start',
      'build',
      'initrd',
      'initconfig',
      'editconfig',
      'log',
      'serve',
    ], data);
  });
}

function usage() {
  shell.echo('USAGE: runtime [command]');
  shell.echo('');
  shell.echo('Available commands:');
  shell.echo('');
  shell.echo('$ runtime start');
  shell.echo('  Start local runtime.js instance in QEMU.');
  shell.echo('');
  shell.echo('  Options:');
  shell.echo('  --build         Rebuild everything before start (the same as "runtime build")');
  shell.echo('  --initrd        Rebuild initrd image before start (the same as "runtime initrd")');
  shell.echo('  --net           Enable networking in QEMU');
  shell.echo('  --netdump       Dump all network activity into vm.pcap file');
  shell.echo('  --kvm           Enable KVM');
  shell.echo('  --curses        Use QEMU in text-mode');
  shell.echo('  --host=[HOST]   Load kernel and initrd over network using HTTP');
  shell.echo('  --port=[PORT]   Port to use for HTTP requests (defaults to 8077)');
  shell.echo('');
  shell.echo('$ runtime build');
  shell.echo('  Build everything (kernel and initrd image from source code).');
  shell.echo('');
  shell.echo('  Options:');
  shell.echo('  --docker        Use docker image to build kernel and initrd. The image should');
  shell.echo('                  be prepared before using this command');
  shell.echo('');
  shell.echo('$ runtime initrd');
  shell.echo('  Build initrd image only.');
  shell.echo('');
  shell.echo('  Options:');
  shell.echo('  --docker        Use docker image to build initrd. The image should be prepared');
  shell.echo('                  before using this command');
  shell.echo('');
  shell.echo('$ runtime initconfig');
  shell.echo('  Create default config file in user home directory (~/.runtimerc.toml).');
  shell.echo('');
  shell.echo('$ runtime editconfig');
  shell.echo('  Open config file in default editor.');
  shell.echo('');
  shell.echo('$ runtime log');
  shell.echo('  Open QEMU serial port log written in --curses mode.');
  shell.echo('');
  shell.echo('$ runtime serve');
  shell.echo('  Serve built kernel and initrd over HTTP. Clients can use CLI to boot');
  shell.echo('  over network using "runtime start --host=[HOST]"');
  shell.echo('');
  shell.echo('  Options:');
  shell.echo('  --build         Rebuild everything before start (the same as "runtime build")');
  shell.echo('  --initrd        Rebuild initrd image before start (the same as "runtime initrd")');
  shell.echo('  --port          HTTP port to use (defaults to 8077)');
  shell.echo('');
  process.exit(1);
}

var command = argv._[0];
if (!command) {
  return usage();
}

if ('initconfig' === command) {
  return config.init(argv);
}

if ('editconfig' === command) {
  return config.edit(argv);
}

var conf = config.parse();
var dockerPrefix = 'docker run --rm -w /mnt -v $(pwd):/mnt:rw runtimejs ';
var runtimePath = resolvePath(conf.RuntimePath);
var crossCompilerPath = resolvePath(conf.CrossCompilerPath);
var kernelPath = pathUtils.resolve(runtimePath, 'disk/boot/runtime');
var initrdPath = pathUtils.resolve(runtimePath, 'disk/boot/initrd');
var logPath = pathUtils.resolve(runtimePath, 'runtime.log');
var log = logfile(logPath);

if ('log' === command) {
  if (!log.exists()) {
    return error('error: no logfile found at "' + logPath + '"');
  }

  return log.less();
}

function build(cb) {
  cb = cb || function() {};
  addPathEnv(pathUtils.resolve(crossCompilerPath, 'bin'));

  var cmd = 'scons';
  if (argv.docker) {
    cmd = dockerPrefix + cmd;
  }

  shellexec('cd ' + runtimePath + ' && ' + cmd, function(code, output) {
    if (0 !== code) {
      return cb(new Error('build failed'));
    }

    shell.echo(' --- build ok --- '.green);
    return cb(null);
  });
}

function initrd(cb) {
  cb = cb || function() {};
  var cmd = './mkinitrd -c disk/boot/initrd initrd';
  if (argv.docker) {
    cmd = dockerPrefix + cmd;
  }

  shellexec('cd ' + runtimePath + ' && ' + cmd, function(code, output) {
    if (0 !== code) {
      return cb(new Error('initrd failed'));
    }

    shell.echo(' --- initrd ok --- '.green);
    return cb(null);
  });
}

function start(cb) {
  cb = cb || function() {};
  var qemu = 'qemu-system-x86_64';
  if (!shell.which(qemu)) {
    return error('error: qemu is not installed (not found qemu-system-x86_64)');
  }

  if (!shell.test('-d', runtimePath) || !shell.test('-f', pathUtils.resolve(runtimePath, 'SConstruct'))) {
    return error('error: could not locate runtime directory at "' + runtimePath + '", check config file');
  }

  function ready(kernelPath, initrdPath, hosted) {
    var kernelStats, initrdStats;

    try {
      kernelStats = fs.statSync(kernelPath);
    } catch (e) {
      return error('error: no kernel found at "' + kernelPath + '"');
    }

    try {
      initrdStats = fs.statSync(initrdPath);
    } catch (e) {
      return error('error: no initrd found at "' + initrdPath + '"');
    }

    var kernelTime = kernelStats.mtime;
    var initrdTime = initrdStats.mtime;

    var a = [
      '-m 512',
      '-smp 1',
      '-s',
      '-kernel ' + kernelPath,
      '-initrd ' + initrdPath,
    ];

    if (argv.net) {
      a.push('-net nic,model=virtio,macaddr=1a:46:0b:ca:bc:7c');

      switch (String(argv.net)) {
      case 'tap':
      case 'bridge':
        a.push('-net bridge');
        break;
      case 'true':
      case 'user':
        a.push('-net user,net=192.168.76.0/24,dhcpstart=192.168.76.9,hostfwd=udp::9000-:9000,hostfwd=tcp::9000-:9000');
        break;
      default:
        return error('error: unknown network type (supported tap/bridge/user)');
      }
    }

    if (argv.netdump) {
      a.push('-net dump,file=vm.pcap');
    }

    if (argv.kvm) {
      a.push('-enable-kvm');
      a.push('-no-kvm-irqchip');
    }

    if (argv.curses) {
      a.push('-curses');
      a.push('-serial file:' + logPath);
    } else {
      a.push('-serial stdio');
    }

    if (hosted) {
      shell.echo(' --- starting qemu (from '.green + hosted.white + ') --- '.green);
    } else if (kernelTime && initrdTime) {
      shell.echo(' --- starting qemu (kernel from '.green +
        moment(kernelTime).fromNow().white + ', initrd from '.green +
        moment(initrdTime).fromNow().white + ') --- '.green);
    } else {
      shell.echo(' --- starting qemu --- '.green);
    }

    log.rm();

    if (argv.curses) {
      exec(qemu, a.join(' ').split(' '), cb);
    } else {
      shellexec(qemu + ' ' + a.join(' '));
    }
  }

  if (argv.host) {
    if (argv.build || argv.initrd) {
      return error('error: current build is local');
    }

    kernelPath = pathUtils.resolve(runtimePath, 'disk/boot/runtime-downloaded');
    initrdPath = pathUtils.resolve(runtimePath, 'disk/boot/initrd-downloaded');

    if (fs.existsSync(kernelPath)) {
      shell.rm('-f', kernelPath);
    }

    if (fs.existsSync(initrdPath)) {
      shell.rm('-f', initrdPath);
    }

    if ('string' !== typeof argv.host) {
      return error('error: invalid url');
    }

    var port = serveHttp.defaultPort;
    if (argv.port) {
      if ('number' !== typeof argv.port) {
        return error('error: invalid port');
      }

      port = argv.port >>> 0;
    }

    var kernelUrl = url.format({ protocol: 'http', hostname: argv.host, port: port, pathname: '/runtime' });
    var initrdUrl = url.format({ protocol: 'http', hostname: argv.host, port: port, pathname: '/initrd' });

    async.series([
      function(callback) {
        shell.echo('Downloading '.yellow + kernelUrl.white + '...');
        try {
        request(kernelUrl)
          .on('response', function(r) { callback(null, r) })
          .on('error', callback)
          .pipe(fs.createWriteStream(kernelPath));
        } catch (e) {
          return error('error: invalid url')
        }
      },
      function(callback) {
        try {
        shell.echo('Downloading '.yellow + initrdUrl.white + '...');
        request(initrdUrl)
          .on('response', function(r) { callback(null, r) })
          .on('error', callback)
          .pipe(fs.createWriteStream(initrdPath));
        } catch (e) {
          return error('error: invalid url')
        }
      }
    ],
    function(err, results) {
      if (err) {
        return error('error: download failed');
      }
      shell.echo(' --- download ok --- '.green);
      ready(kernelPath, initrdPath, argv.host);
    });
  } else {
    ready(kernelPath, initrdPath);
  }
}

function serve(cb) {
  var port;

  if (argv.port) {
    if ('number' !== typeof argv.port) {
      return error('error: invalid port');
    }

    port = argv.port;
  }

  serveHttp(kernelPath, initrdPath, port);
}

switch (command) {
case 'start':
  if (argv.build) {
    return async.waterfall([build, start]);
  }

  if (argv.initrd) {
    return async.waterfall([initrd, start]);
  }

  return start();
  break;
case 'build': return build();
case 'initrd': return initrd();
case 'serve':
  if (argv.build) {
    return async.waterfall([build, serve]);
  }

  if (argv.initrd) {
    return async.waterfall([initrd, serve]);
  }

  return serve();
default: return error('error: unknown command');
}
