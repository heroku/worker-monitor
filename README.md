# worker-monitor

A module for monitoring the memory usage of Node worker processes, and killing
them when they reach a specified limit. This module is designed to be used in
conjunction with [clusterflock](https://github.com/jclem/clusterflock).

## Usage

Simply require and call `worker-monitor` for it to begin monitoring worker
processes:

```javascript
require('worker-monitor')();
```

### Options

The `worker-monitor` function accepts a few options:

- `disconnectTimeout` (Default: `5000`) The time after which a disconnecting
  worker will be immediately killed if it has failed to disconnect.
- `logPeriod` (Default: `10000`) The frequency with with a worker's memory usage
  will be logged.
- `monitorPeriod` (Default: `5000`) The frequency with with a worker's memory
  is monitored. This is when the worker will be killed if it exceeds
  `memoryLimit`.
- `memoryLimit` (Default: `220000000`) The limit (in bytes) that a worker's RSS
  may be.

For example:

```javascript
require('worker-monitor')({
  disconnectTimeout: 10000,
  logPeriod        : 5000
});
```

## Handling killed workers

If you'd like to perform an action when a worker will be disconnected, tell your
master worker to watch for a `workerExceededMemory` message:

```javascript
var cluster = require('cluster');

if (cluster.isMaster) {
  process.on('message', function(message) {
    if (message === 'workerExceededMemory') {
      cluster.fork(); // Fork a new worker
    }
  });
}
```
