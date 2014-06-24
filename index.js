'use strict';

var cluster       = require('cluster');
var WorkerMonitor = require('./lib/worker-monitor');

module.exports = function(options) {
  if (cluster.isWorker) {
    return new WorkerMonitor(cluster.worker, options);
  }
};
