/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var Boom = require('boom');

var config = require('../config');
var log = require('../logger')('server.controllers.visits');
var visits = require('../models/visits');
var visitsView = require('../views/visits');
var visitController = require('./visit');

var visitsController = {
  get: function (request, reply) {
    var userId = request.auth.credentials;
    var visitId = request.query.visitId;

    function onResults(err, results) {
      if (err) {
        log.warn(err);
        return reply(Boom.create(500)); // TODO distinguish between 4xx and 5xx?
      }
      if (!results) {
        return reply(Boom.create(404)); // not found
      }
      // for each visit in results, add the screenshot url
      reply(visitsView.render(results));
    }

    // if there's a visitId provided, then we want a specific page
    if (visitId) {
      visits.getPaginated(userId, visitId, request.query.count, onResults);
    } else {
      visits.get(userId, request.query.count, onResults);
    }
  },
  bulk: function(request, reply) {
    var priority = request.payload.priority;
    var userId = request.auth.credentials;
    var bulkVisits = request.payload.visits;
    if (!Array.isArray(bulkVisits)) { bulkVisits = [bulkVisits]; }

    var bulkResponse = [];
    var visit;
    bulkVisits.forEach(function(v) {
      visit = visitController._create(userId, v.url, v.title, v.visitedAt, v.visitId, priority);
      bulkResponse.push(visit);
    });

    reply(bulkResponse);
  }
};

module.exports = visitsController;
