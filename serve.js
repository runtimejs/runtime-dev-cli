var http = require('http');
var url = require('url');
var fs = require('fs');
var error = require('./error');
var shelljs = require('shelljs');
require('colors');

var defaultPort = 8077;

module.exports = function(kernelPath, initrdPath, ipxePath, port) {
  var port = port || defaultPort;

  if (!fs.existsSync(kernelPath)) {
    return error('error: no kernel found at "' + kernelPath + '"');
  }

  if (!fs.existsSync(initrdPath)) {
    return error('error: no initrd found at "' + initrdPath + '"');
  }

  if (!fs.existsSync(ipxePath)) {
    return error('error: no ipxe.txt found at "' + ipxePath + '"');
  }

  var server = http.createServer(function(req, res) {
    var uri = url.parse(req.url).pathname;

    var servePath;
    var contentType;

    if ('/runtime' === uri) {
      servePath = kernelPath;
      contentType = 'application/octet-stream';
    }

    if ('/initrd' === uri) {
      servePath = initrdPath;
      contentType = 'application/octet-stream';
    }

    if ('/ipxe.txt' === uri) {
      servePath = ipxePath;
      contentType = 'text/plain';
    }

    if (servePath) {
      var ip = req.connection.remoteAddress;
      shelljs.echo('['.gray + ip.gray + '] '.gray + 'GET '.magenta + uri.yellow + ' \u2192 ' + servePath.green);
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(servePath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  })

  server.listen(port);

  server.on('listening', function() {
    shelljs.echo('listening to port ' + String(port).yellow);
  });

  server.on('error', function() {
    return error('error: serve failed');
  });
};

module.exports.defaultPort = defaultPort;
