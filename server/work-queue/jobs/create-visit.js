/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var visit = require('../../models/visit');
var log = require('../../logger')('server.work-queue.jobs.create-visit');

module.exports = {
  // data is an object with keys { userId, visitId, url, urlHash, title, visitedAt }
  // TODO use priority
  perform: function(data, cb) {
    log.trace('createVisit.perform called with params ' + JSON.stringify(data));
    if (!data.url) {
      log.critical('createVisit.perform called with no url, wtf');
      return cb(new Error('create-visit.perform called with bullshit arguments:' + JSON.stringify(data)));
    }
    visit.create(data.userId, data.id, data.visitedAt, data.url, data.urlHash, data.title, function (err) {
      log.verbose('inside the visit.create callback inside the createVisit job!');
      if (err) {
        log.warn('failed at visit.create step for visit url ' + data.url + ' :' + err);
      }
      cb(err);
    });
  }
};
