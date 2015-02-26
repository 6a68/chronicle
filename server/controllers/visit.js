/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var crypto = require('crypto');
var uuid = require('uuid');
var Boom = require('boom');

var queue = require('../work-queue/queue');
var config = require('../config');
var isEmbedlyEnabled = config.get('embedly_enabled');
var log = require('../logger')('server.controllers.visit');
var visit = require('../models/visit');
var visitView = require('../views/visit');

// TODO when we turn this into a real instantiable object, set req, reply as instance vars
var visitController = {
  get: function (request, reply) {
    var userId = request.auth.credentials;
    visit.get(userId, request.params.visitId, function(err, result) {
      if (err) {
        log.warn(err);
        return reply(Boom.create(500));
      }
      if (!result) {
        return reply(Boom.create(404, 'Visit not found'));
      } else {
        reply(visitView.render(result));
      }
    });
  },
  post: function(request, reply) {
    var p = request.payload;
    var userId = request.auth.credentials;

    var created = visitController._create(userId, p.url, p.title, p.visitedAt, p.visitId);
    reply(visitView.render(created));
  },
  put: function(request, reply) {
    var userId = request.auth.credentials;
    var visitId = request.params.visitId;
    var p = request.payload;
    visit.update(userId, visitId, p.visitedAt, p.url, p.title, function(err, result) {
      if (err) {
        log.warn(err);
        return reply(Boom.create(500));
      }
      reply(visitView.render(result));
    });
  },
  delete: function (request, reply) {
    var userId = request.auth.credentials;
    visit.delete(userId, request.params.visitId, function(err) {
      if (err) {
        log.warn(err);
        return reply(Boom.create(500));
      }
      reply();
    });
  },
  // TODO this really belongs on a model, not a controller
  _create: function(userId, url, title, visitedAt, visitId, priority) {
    visitId = visitId || uuid.v4();
    priority = priority || 'regular';
    var urlHash = crypto.createHash('sha1').update(url).digest('hex').toString();
    var data = {
      userId: userId,
      id: visitId,
      url: url,
      urlHash: urlHash,
      title: title,
      visitedAt: visitedAt
    };

    queue.createVisit({ priority: priority, data: data });
    if (isEmbedlyEnabled) {
      // extractPage doesn't need all these keys, but the extras won't hurt anything
      // XXX the extractPage job checks if the user_page has been scraped recently
      queue.extractPage({ priority: priority, data: data });
    }

    return data;
  }
};

module.exports = visitController;
