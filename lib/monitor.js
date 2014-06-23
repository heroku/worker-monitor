'use strict';

var logfmt     = require('logfmt');
var prettysize = require('prettysize');

/**
 * Monitors and logs the memory usage of a worker process and sends a
 * notification when a limit is exceeded.
 *
 * @class Monitor
 * @constructor
 * @param {Worker} worker the Node worker to monitor
 * @param {Object} options options to override defaults
 * @param {Number} options.logPeriod the period (in milliseconds) on which to
 *   log the worker's memory usage
 * @param {Number} options.monitorPeriod the period (in milliseconds) on which
 *   to monitor the worker's memory usage
 * @param {Number} options.memoryLimit the memory usage limit (in bytes) of the
 *   worker process
 */
function Monitor(worker, options) {
  this.worker            = worker;
  this.logPeriod         = options.logPeriod || 10000;
  this.monitorPeriod     = options.monitorPeriod || 10000;
  this.memoryLimit       = options.memoryLimit || 220000000;
  this.monitorIntervalID = this.getMonitorIntervalID();
  this.logIntervalID     = this.getLogIntervalID();
  this.source            = 'worker.' + worker.id;
}

/**
 * Return the ID for an interval on which to log the memory usage of this
 * worker.
 *
 * @method getLogIntervalID
 * @return {Number} an interval ID
 */
Monitor.prototype.getLogIntervalID = function monitorGetLogIntervalID() {
  var logFn = this.log.bind(this);
  return setInterval(logFn, this.logPeriod);
};

/**
 * Return the ID for an interval on which to monitor the memory usage of this
 * worker.
 *
 * @method getMonitorIntervalID
 * @return {Number} an interval ID
 */
Monitor.prototype.getMonitorIntervalID = function monitorGetMonitorIntervalID() {
  var monitorFn = this.monitor.bind(this);
  return setInterval(monitorFn, this.monitorPeriod);
};

/**
 * Log the memory usage of the worker.
 *
 * @method log
 */
Monitor.prototype.log = function monitorLog() {
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
 * Check the memory usage of the worker and send a notification if it exceeds
 * `Monitor.MEMORY_LIMIT`.
 *
 * @method monitor
 */
Monitor.prototype.monitor = function monitorMonitor() {
  var rss = process.memoryUsage().rss;

  if (rss > this.memoryLimit) {
    clearInterval(this.monitorIntervalID);
    clearInterval(this.logIntervalID);
    process.send('exceedsMemoryLimit');
  }
};

module.exports = Monitor;
