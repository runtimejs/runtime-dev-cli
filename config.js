var toml = require('toml');
var fs = require('fs');
var shell = require('shelljs');
var pathUtils = require('path');
var error = require('./error');

var name = '.runtimerc.toml';
var configPath = pathUtils.resolve(getUserHome(), name);

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function exists() {
  return shell.test('-f', configPath);
}

module.exports = {
  parse: function() {
    if (!exists()) {
      return error([
        'error: could not read "~/' + name + '" config file',
        'error: use "runtime initconfig" to create using default settings',
      ]);
    }

    try {
      return toml.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      return error('error: config file parse error: ' + e.message);
    }
  },
  init: function(argv) {
    if (exists() && !argv.force) {
      return error('error: config file already exists, use --force to overwrite');
    }

    shell.cp('-f', pathUtils.resolve(__dirname, name), configPath);
    shell.echo('created "' + configPath + '" config file');
    shell.exit(0);
  }
};



