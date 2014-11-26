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

if(process.argv.slice(2)[0] === 'completion') {
  return tabtab.complete('runtime', function(err, data) {
    if(err || !data) return;

    tabtab.log([
      'start',
      'build',
      'initrd',
      'initconfig',
      'editconfig',
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
  shell.echo('  --build    Rebuild everything before start (the same as "runtime build")');
  shell.echo('  --initrd   Rebuild initrd image before start (the same as "runtime initrd")');
  shell.echo('  --net      Enable networking in QEMU');
  shell.echo('  --netdump  Dump all network activity into vm.pcap file');
  shell.echo('  --kvm      Enable KVM');
  shell.echo('  --curses   Use QEMU in text-mode');
  shell.echo('');
  shell.echo('$ runtime build');
  shell.echo('  Build everything (kernel and initrd image from source code).');
  shell.echo('');
  shell.echo('  Options:');
  shell.echo('  --docker   Use docker image to build kernel and initrd. The image should');
  shell.echo('             be prepared before using this command');
  shell.echo('');
  shell.echo('$ runtime initrd');
  shell.echo('  Build initrd image only.');
  shell.echo('');
  shell.echo('  Options:');
  shell.echo('  --docker   Use docker image to build initrd. The image should be prepared');
  shell.echo('             before using this command');
  shell.echo('');
  shell.echo('$ runtime initconfig');
  shell.echo('  Create default config file in user home directory (~/.runtimerc.toml).');
  shell.echo('');
  shell.echo('$ runtime editconfig');
  shell.echo('  Open config file in default editor.');
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

  var a = [
    '-m 512',
    '-smp 1',
    '-s',
    '-kernel ' + pathUtils.resolve(runtimePath, 'disk/boot/runtime'),
    '-initrd ' + pathUtils.resolve(runtimePath, 'disk/boot/initrd'),
  ];

  if (argv.net) {
    a.push('-net nic,model=virtio,macaddr=1a:46:0b:ca:bc:7c');
    a.push('-net user,net=192.168.76.0/24,dhcpstart=192.168.76.9,hostfwd=udp::9000-:9000,hostfwd=tcp::9000-:9000');
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
    a.push('-serial file:serial.txt');
  } else {
    a.push('-serial stdio');
  }

  shell.echo(' --- starting qemu --- '.green);
  if (argv.curses) {
    exec(qemu, a.join(' ').split(' '), cb);
  } else {
    shellexec(qemu + ' ' + a.join(' '));
  }
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
default: return error('error: unknown command');
}
