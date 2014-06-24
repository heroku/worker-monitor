'use strict';

var cluster       = require('cluster');
var WorkerMonitor = require('./lib/worker-monitor');

module.exports = function(options) {
  return new WorkerMonitor(cluster.worker, options);
};
