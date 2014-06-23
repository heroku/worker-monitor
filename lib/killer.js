'use strict';

var logfmt = require('logfmt');

/**
 * Kills a worker when the worker receives an `exceedsMemoryLimit` signal.
 *
 * @class Killer
 * @constructor
 * @param {Worker} worker the Node worker to monitor
 * @param {Object} options options to override defaults
 * @param {Number} options.disconnectTimeout the time after which a
 *   disconnecting worker should be killed immediately
 */
function Killer(worker, options) {
  this.worker            = worker;
  this.disconnectTimeout = options.disconnectTimeout || 5000;

  this.worker.on('message', function(message) {
    if (message === 'exceedsMemoryLimit') {
      this.disconnectWorker();
    }
  }.bind(this));
}

/**
 * Kill the worker by disconnecting it, and then killing it when a timeout is
 * exceeded.
 *
 * @method disconnectWorker
 */
Killer.prototype.disconnectWorker = function killerDisconnectWorker() {
  logfmt.log({
    source : 'master',
    message: 'worker exceeded memory limit',
    worker : this.worker.id,
    pid    : this.worker.process.pid,
    'count#worker-exceeded-memory': 1
  });

  this.worker.disconnect();

  var killTimeoutID = setTimeout(function() {
    this.killWorker();
  }.bind(this), this.disconnectTimeout);

  this.worker.on('disconnect', function() {
    clearTimeout(killTimeoutID);
  });
};

/**
 * Kill the worker process immediately by sending it `SIGINT`.
 *
 * @method killWorker
 */
Killer.prototype.killWorker = function killerKillWorker() {
  logfmt.log({
    source : 'master',
    message: 'worker failed to disconnect by timeout',
    worker : this.worker.id,
    pid    : this.worker.process.pid,
    'count#worker-disconnect-failed': 1
  });

  this.worker.kill('SIGINT');
};

module.exports = Killer;
