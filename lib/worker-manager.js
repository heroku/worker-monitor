'use strict';

var cluster = require('cluster');
var logfmt  = require('logfmt');

/**
 * Monitors workers for "workerExceededMemory" messages and ensure that worker
 * processes are killed after disconnect, and a new worker is forked.
 *
 * @class WorkerManager
 * @constructor
*/
function WorkerManager() {
  cluster.on('fork', function(worker) {
    this.setupWorkerMonitor(worker);
  }.bind(this));
}

/**
 * When a new worker is forked, ensure that they are monitored for the
 * "workerExceededMemory" message.
 *
 * @method setupWorkerMonitor
 * @param {Worker} worker the worker to be monitored
 * @private
 */
WorkerManager.prototype.setupWorkerMonitor = function workerManagerSetupWorkerMonitor(worker) {
  worker.on('message', function(message) {
    if (message === 'workerExceededMemory') {
      this.killAndForkOnDisconnect(worker);
    }
  }.bind(this));
};

/**
 * When a worker disconnects, ensure that its process is killed and that a new
 * worker is forked.
 *
 * @method killAndForkOnDisconnect
 * @param {Worker} worker the worker to kill
 * @private
 */
WorkerManager.prototype.killAndForkOnDisconnect = function workerManagerKillAndForkOnDisconnect(worker) {
  worker.on('disconnect', function() {
    worker.kill('SIGINT');
    this.logKilledWorker(worker);
    cluster.fork();
  }.bind(this));
};

/**
 * Log a message indicating that a worker has been disconnected and its process
 * killed.
 *
 * @method logKilledWorker
 * @param {Worker} worker the worker which has been killed
 * @private
 */
WorkerManager.prototype.logKilledWorker = function workerManagerLogKilledWorker(worker) {
  logfmt.log({
    source: 'master',
    worker: worker.id,
    pid   : worker.process.pid,
    'count#worker-disconnected-and-killed': 1
  });
};

module.exports = WorkerManager;
