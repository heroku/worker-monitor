'use strict';

var cluster       = require('cluster');
var WorkerMonitor = require('./lib/worker-monitor');
var WorkerManager = require('./lib/worker-manager');

module.exports = function(options) {
  if (cluster.isWorker) {
    return new WorkerMonitor(cluster.worker, options);
  } else {
    return new WorkerManager();
  }
};
