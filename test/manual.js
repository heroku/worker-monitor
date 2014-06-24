'use strict';

require('..')({
  logPeriod: 10000,
  monitorPeriod: 5000,
  disconnectTimeout: 2000,
  memoryLimit: 1
});

var clusterflock = require('clusterflock');

clusterflock(function(req, res) {
  setTimeout(function() {
    res.end('ok');
  }, process.env.REQUEST_TIMEOUT || 20000);
});
