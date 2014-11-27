var fs = require('fs');
var exec = require('./exec');
var shelljs = require('shelljs');

module.exports = function(path) {
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
      exec('less', [path], cb);
    },
    rm: function(cb) {
      if (exists()) {
        shelljs.rm('-f', path);
      }
    }
  };
};
