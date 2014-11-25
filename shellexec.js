require('colors');
var shell = require('shelljs');
var running = [];

process.on('SIGINT', function() {
  running.forEach(function(p) {
    p.kill('SIGINT');
  });

  shell.echo(' --- interrupted --- '.yellow);
  process.exit(0);
});

function shellexec(cmd, cb) {
  var p = shell.exec(cmd, { async: true }, function(code, output) {
    var index = running.indexOf(p);
    if (index > -1) {
      running.splice(index);
    }

    if ('function' === typeof cb) {
      return cb(code, output);
    }
  });

  running.push(p);
}

module.exports = shellexec;
