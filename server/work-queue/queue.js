/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var nr = require('node-resque');
var Q = require('q');

var config = require('../config');
var log = require('../logger')('server.work-queue');
var jobs = require('./jobs');

var queueReady = Q.defer();
var workersReady = Q.defer();

var connectionDetails = {
  host: config.get('db_redis_host'),
  password: config.get('db_redis_password'),
  port: config.get('db_redis_port'),
  database: config.get('db_redis_database')
};

var queueOpts = { connection: connectionDetails };
var queue = new nr.queue(queueOpts, jobs, function onQueueReady() {
  log.info('queue started');
  // TODO listen for queue events?
  queueReady.resolve();
});

var multiWorkerOpts = {
  connection: connectionDetails,
  queues: ['chronicle'],
  minTaskProcessors: 1,
  maxTaskProcessors: 1,
};

var worker = new nr.worker({connection: connectionDetails, queues: ['chronicle']}, jobs, function() {
  worker.on('start',           function(){ console.log("worker started"); })
  worker.on('end',             function(){ console.log("worker ended"); })
  worker.on('cleaning_worker', function(worker, pid){ console.log("cleaning old worker " + worker); })
  worker.on('poll',            function(queue){ console.log("worker polling " + queue); })
  worker.on('job',             function(queue, job){ console.log("working job " + queue + " " + JSON.stringify(job)); })
  worker.on('reEnqueue',       function(queue, job, plugin){ console.log("reEnqueue job (" + plugin + ") " + queue + " " + JSON.stringify(job)); })
  worker.on('success',         function(queue, job, result){ console.log("job success " + queue + " " + JSON.stringify(job) + " >> " + result); })
  worker.on('failure',         function(queue, job, failure){ console.log("job failure " + queue + " " + JSON.stringify(job) + " >> " + failure); })
  worker.on('error',           function(queue, job, error){ console.log("error " + queue + " " + JSON.stringify(job) + " >> " + error); })
  worker.on('pause',           function(){ console.log("worker paused"); })
  worker.workerCleanup();
  worker.start();
});
/*
var multiWorker = new nr.multiWorker(multiWorkerOpts, jobs, function() {
  multiWorker.on('success', function(workerId, queueName, job, result){
    // TODO do something with result?
    log.info('worker[' + workerId + '] job success ' + queueName);
    log.verbose('worker[' + workerId + '] job success ' + queueName + ' ' +
      JSON.stringify(job) + ' >> ' + result);
  jkk
  });
  multiWorker.on('failure', function(workerId, queueName, job, failure){
    log.warn('worker failed, job will be retried in 10 seconds');
    log.verbose('worker[' + workerId + '] job failure ' + queueName + ' ' +
      JSON.stringify(job) + ' >> ' + failure);
    
  });
  multiWorker.on('error', function(workerId, queueName, job, error){
    log.warn('worker errored');
    log.verbose('worker[' + workerId + '] error ' + queueName + ' ' +
      JSON.stringify(job) + ' >> ' + error);
  });
  multiWorker.on('pause', function(workerId){
    log.verbose('worker[' + workerId + '] paused');
  });

  // multiWorker emitters
  multiWorker.on('internalError', function(error){
    log.warn('multiworker error: ' + error);
  });
  multiWorker.on('multiWorkerAction', function(verb, delay){
    log.verbose('*** checked for worker status: ' + verb +
      ' (event loop delay: ' + delay + 'ms)');
  });
  multiWorker.start();
  log.verbose('queue workers are ready');
  workersReady.resolve();
});
*/

// TODO add reject handler when we listen for queue/worker startup failures
//Q.all([queueReady.promise, workersReady.promise]).then(function() {
// TODO: be fancy, loop over jobs
// TODO figure out the callback contract between queue and worker
// (not between queue and queue caller, those should be fire-and-forget)
module.exports = {
  createVisit: function(o) {
    log.critical('createVisit queue method invoked, we are passing in o.data: ' + JSON.stringify(o.data));
    var args = {
      url: o.data.url,
      userId: o.data.userId,
      id: o.data.id,
      title: o.data.title,
      visitedAt: o.data.visitedAt
    };
    log.critical('createVisit has now copied everything into a new args variable: ' + JSON.stringify(args));

    queue.enqueue('chronicle', 'createVisit', o.data, function(err, resp) {
      log.trace('what happened after we enqueued?');
      if (err) {
        log.critical('createVisit job failed to enqueue: ' + err);
      }
      log.critical('createVisit job enqueued? ' + resp);
    });
  },
  extractPage: function(o) {
    log.critical('extractPage queue method invoked, o is ' + JSON.stringify(o));
    queue.enqueue('chronicle', 'extractPage', [o.data], function(err, data) {
      if (err) {
        log.critical('extractPage job failed to enqueue: ' + err);
      }
      log.critical('extractPage job enqueued? ' + data);
    });
  }
};
//});

process.on('SIGINT', function () {
  log.warn('process exiting, shutting down workers');
  worker.end();
  process.exit();
});
