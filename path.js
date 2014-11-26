var pathUtils = require('path');

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

module.exports = {
  resolvePath: function(path) {
    return String(path).split('${HOME}').join(getUserHome());
  },
  addPathEnv: function(addPath) {
    var paths = process.env.PATH.split(pathUtils.delimiter);
    if (paths.indexOf(addPath) > -1) {
      return;
    }

    paths.unshift(addPath);
    process.env.PATH = paths.join(pathUtils.delimiter);
  }
};
