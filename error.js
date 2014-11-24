require('colors');
var shell = require('shelljs');

module.exports = function(text) {
  if (Array.isArray(text)) {
    text.forEach(function(value) {
      shell.echo(value.red);
    });
  } else {
    shell.echo(text.red);
  }
  shell.exit(1);
}
