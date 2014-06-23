'use strict';

var cluster = require('cluster');
var Monitor = require('./lib/monitor');
var Killer  = require('./lib/killer');

exports.start = function(options) {
  options = options || {};

  if (cluster.isWorker) {
    new Monitor(cluster.worker, options);
  } else {
    cluster.on('fork', function(worker) {
      new Killer(worker, options);
    });
  }
};
