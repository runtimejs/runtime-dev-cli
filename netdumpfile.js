var fs = require('fs');
var exec = require('./exec');
var shell = require('shelljs');
var shellexec = require('./shellexec');

module.exports = function(path, txtpath) {
  function exists() {
    try {
      var logstats = fs.statSync(path);
      return true;
    } catch (e) {}

    return false;
  }

  return {
    exists: exists,
    less: function(cb) {
      cb = cb || function() {};
      if (!shell.which('tcpdump')) {
        return error('error: tcpdump is not installed');
      }

      shellexec('tcpdump -ns 0 -X -vvv -r ' + path + ' > ' + txtpath, function(code, output) {
        if (0 !== code) {
          return error('error: tcpdump failed');
        }

        exec('less', [txtpath], cb);
      });
    },
    rm: function(cb) {
      if (exists()) {
        shell.rm('-f', path);
      }
    }
  };
};
