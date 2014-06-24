'use strict';

var logfmt     = require('logfmt');
var prettysize = require('prettysize');

/**
 * Monitors and logs the memory usage of a worker process and kills the process
 * when a limit is exceeded.
 *
 * @class WorkerMonitor
 * @constructor
 * @param {Worker} worker the Node worker to monitor
 * @param {Object} options options to override defaults
 * @param {Number} options.disconnectTimeout the time after which a
 *   disconnecting worker should be killed immediately
 * @param {Number} options.logPeriod the period (in milliseconds) on which to
 *   log the worker's memory usage
 * @param {Number} options.monitorPeriod the period (in milliseconds) on which
 *   to monitor the worker's memory usage
 * @param {Number} options.memoryLimit the memory usage limit (in bytes) of the
 *   worker process
 */
function WorkerMonitor(worker, options) {
  this.worker             = worker;
  this.disconnectTimeout  = options.disconnectTimeout || 5000;
  this.logPeriod          = options.logPeriod || 10000;
  this.monitorPeriod      = options.monitorPeriod || 10000;
  this.memoryLimit        = options.memoryLimit || 220000000;
  this.monitorInterval    = this.getMonitorInterval();
  this.logInterval        = this.getLogInterval();
  this.source             = 'worker.' + worker.id;
}

/**
 * Kill the worker by disconnecting it, and then killing it when a timeout is
 * exceeded.
 *
 * @method disconnectWorker
 */
WorkerMonitor.prototype.disconnectWorker = function workerMonitorDisconnectWorker() {
  logfmt.log({
    source : 'master',
    message: 'worker exceeded memory limit',
    worker : this.worker.id,
    pid    : this.worker.process.pid,
    'count#worker-exceeded-memory': 1
  });

  process.send('workerExceededMemory');
  this.worker.disconnect();

  var killTimeout = setTimeout(function() {
    this.killWorker();
  }.bind(this), this.disconnectTimeout);

  killTimeout.unref();

  this.worker.on('disconnect', function() {
    clearTimeout(killTimeout);
  }.bind(this));
};

/**
 * Kill the worker process immediately by sending it `SIGINT`.
 *
 * @method killWorker
 */
WorkerMonitor.prototype.killWorker = function workerMonitorKillWorker() {
  logfmt.log({
    source : 'master',
    message: 'worker failed to disconnect by timeout',
    worker : this.worker.id,
    pid    : this.worker.process.pid,
    'count#worker-disconnect-failed': 1
  });

  this.worker.kill('SIGINT');
};

/**
 * Return the ID for an interval on which to log the memory usage of this
 * worker.
 *
 * @method getLogInterval
 * @return {Number} an interval ID
 */
WorkerMonitor.prototype.getLogInterval = function workerMonitorGetLogInterval() {
  var logFn = this.log.bind(this);
  return setInterval(logFn, this.logPeriod);
};

/**
 * Return the ID for an interval on which to monitor the memory usage of this
 * worker.
 *
 * @method getMonitorInterval
 * @return {Number} an interval ID
 */
WorkerMonitor.prototype.getMonitorInterval = function workerMonitorGetMonitorInterval() {
  var monitorFn = this.monitor.bind(this);
  return setInterval(monitorFn, this.monitorPeriod);
};

/**
 * Log the memory usage of the worker.
 *
 * @method log
 */
WorkerMonitor.prototype.log = function workerMonitorLog() {
  var memoryUsage = process.memoryUsage();

  logfmt.log({
    source             : this.source,
    pid                : process.pid,
    'measure#rss'      : prettysize(memoryUsage.rss, true),
    'measure#heapTotal': prettysize(memoryUsage.heapTotal, true),
    'measure#heapUsed' : prettysize(memoryUsage.heapUsed, true)
  });
};

/**
 * Check the memory usage of the worker and start the graceful disconnect
 * process if the usage exceeds the memory limit.
 *
 * @method monitor
 */
WorkerMonitor.prototype.monitor = function workerMonitorMonitor() {
  var rss = process.memoryUsage().rss;

  if (rss > this.memoryLimit) {
    clearInterval(this.monitorInterval);
    clearInterval(this.logInterval);
    this.disconnectWorker();
  }
};

module.exports = WorkerMonitor;
