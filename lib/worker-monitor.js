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
 * @param {Object} [options={}] options to override defaults
 * @param {Number} [options.disconnectTimeout=5000] the time after which a
 *   disconnecting worker should be killed immediately
 * @param {Number} [options.logPeriod=10000] the period (in milliseconds) on which to
 *   log the worker's memory usage
 * @param {Number} [options.monitorPeriod=10000] the period (in milliseconds) on which
 *   to monitor the worker's memory usage
 * @param {Number} [options.memoryLimit=220000000] the memory usage limit (in bytes) of the
 *   worker process
 */
function WorkerMonitor(worker, options) {
  options = options || {};

  /**
   * The worker to be monitored and killed if its RSS exceeds
   * {{#crossLink "WorkerMonitor/memoryLimit:property"}}`memoryLimit`{{/crossLink}}
   *
   * @property worker
   * @type Worker
   */
  this.worker = worker;

  /**
   * The timeout after attempting to disconnect a worker when the worker is
   * killed forcefully.
   *
   * @property disconnectTimeout
   * @type Number
   * @default 5000
   */
  this.disconnectTimeout = options.disconnectTimeout || 5000;

  /**
   * The period on which the worker's memory is logged. If null, memory will not
   * be logged.
   *
   * @property logPeriod
   * @type Number,null
   * @default 10000
   */
  this.logPeriod = options.logPeriod === undefined ? 10000 : options.logPeriod;

  /**
   * The period on which the worker has its memory checked and is possibly
   * disconnected. If null, memory will not be monitored (this allows for only
   * logging memory).
   *
   * @property monitorPeriod
   * @type Number,null
   * @default 10000
   */
  this.monitorPeriod = options.monitorPeriod === undefined ? 10000 : options.monitorPeriod;

  /**
   * The limit (in bytes) that a process's RSS can grow to before it is killed.
   *
   * @property memoryLimit
   * @type Number
   * @default 220000000
   */
  this.memoryLimit = options.memoryLimit || 220000000;

  /**
   * The interval ID referring to the interval that calls the monitor function.
   *
   * @property monitorInterval
   * @private
   * @type Number
   */
  this.monitorInterval = this.getMonitorInterval();

  /**
   * The interval ID referring to the interval that calls the logging function.
   *
   * @property logInterval
   * @private
   * @type Number
   */
  this.logInterval = this.getLogInterval();

  /**
   * The source string, used in logging, for identifying this particular worker.
   *
   * @property source
   * @private
   * @type String
   */
  this.source = 'worker.' + worker.id;
}

/**
 * Kill the worker by disconnecting it, and then killing it when a timeout is
 * exceeded.
 *
 * @method disconnectWorker
 * @private
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
 * @private
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
 * worker. Returns `null` if
 * {{#crossLink "WorkerMonitor/logPeriod:property}}`logPeriod`{{/crossLink}} is
 * `null`.
 *
 * @method getLogInterval
 * @private
 * @return {Number,null} an interval ID or `null`
 */
WorkerMonitor.prototype.getLogInterval = function workerMonitorGetLogInterval() {
  var logFn = this.log.bind(this);

  if (this.logPeriod !== null) {
    return setInterval(logFn, this.logPeriod);
  } else {
    return null;
  }
};

/**
 * Return the ID for an interval on which to monitor the memory usage of this
 * worker. Returns `null` if
 * {{#crossLink "WorkerMonitor/monitorPeriod:property}}`monitorPeriod`{{/crossLink}}
 * is `null`.
 *
 * @method getMonitorInterval
 * @private
 * @return {Number,null} an interval ID or null
 */
WorkerMonitor.prototype.getMonitorInterval = function workerMonitorGetMonitorInterval() {
  var monitorFn = this.monitor.bind(this);

  if (this.monitorPeriod !== null) {
    return setInterval(monitorFn, this.monitorPeriod);
  } else {
    return null;
  }
};

/**
 * Log the memory usage of the worker.
 *
 * @method log
 * @private
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
 * @private
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
