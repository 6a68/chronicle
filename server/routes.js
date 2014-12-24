/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var wreck = require('wreck');
var path = require('path');
var Joi = require('joi');

var log = require('./logger')('server.routes');
var config = require('./config');
var db = require('./db/db');

// data definitions for RESTful response validation
var schemas = {
  url_Hash: Joi.string().regex('/^[0-9a-fA-F]{40}$/'), // hex-encoded SHA1 hash
  visits: Joi.array.min(0).max(1000).required().includes(schemas.visit),
  visit: Joi.object({
    url_hash: schemas.urlHash,
    url: Joi.string().required(),
    title: Joi.string().required(),
    favicon_url: Joi.string().required(),
    content: Joi.string(),
    image_url: Joi.string(),
    image_height: Joi.integer(),
    image_width: Joi.integer()
  })
};

// TODO: underscores for API params and querystring params. camelCase for functions/vars.
// TODO: how do we handle multiple visits from the same user? need to include timestamp
//       somehow, and need to make sure the hash reflects the visit.
//       maybe it should be visit_hash instead of url_hash. or visit_id?
// TODO: clearly this file length is getting out of control, split it soonish
module.exports = [{
  method: 'PUT',
  path: '/v1/visits/{url_hash}',
  config: {
    auth: 'session',
    validate: {
      params: {
        url_hash: schemas.url_hash
      }
    },
    handler: function(request, reply) {
      // validate the visit exists + belongs to user
      // update the DB, then fire a 200 back
      reply();
    }
  }
}, {
  method: 'PATCH',
  path: '/v1/visits/{url_hash}',
  config: {
    auth: 'session',
    validate: {
      params: {
        url_hash: schemas.urlHash
      }
    },
    handler: function(request, reply) {
      reply(); 
    }
  }
}, {
  method: 'POST',
  path: '/v1/visits',
  config: {
    auth: 'session',
    validate: {
      params: {
        url: Joi.string().required(),
        title: Joi.string().required()
      }
    },
    handler: function(request, reply) {
      // validate the new visit(s) and shove in the DB
      // return the new visit's uuid in the response
      var fxaId = request.auth.credentials.fxaId;
    }
  }
}, {
  method: 'GET',
  path: '/v1/visits/{urlHash}',
  config: {
    auth: 'session',
    validate: {
      params: {
        urlHash: schemas.urlHash
      }
    },
    handler: function(request, reply) {
      // given (fxaId, urlHash), fetch the visit from the DB
      // TODO: is this user_pages or visits?
    }
  }
}, {
  method: 'GET',
  path: '/v1/visits',
  config: {
    auth: 'session',
    validate: {
      query: {
        offset: Joi.integer().min(0).max(1000000).default(0),
        count: Joi.integer().min(1).max(1000).default(20)
      }
    },
    response: {
      schema: {
        offset: Joi.integer().min(0).max(1000000),
        // response count may be 0 because there may be no records found
        count: Joi.integer().max(1000),
        visits: Joi.array().min(0).max(1000).required().includes(Joi.object({
          url_hash: Joi.string().required(), // TODO fixed length for url hash?
          url: Joi.string().required(),
          title: Joi.string().required(),
          favicon_url: Joi.string().required(),
          content: Joi.string(),
          image_url: Joi.string(),
          image_height: Joi.integer(),
          image_width: Joi.integer()
        }))
      }
    },
    handler: function(request, reply) {
      // TODO: ensure hapi-auth-cookie correctly sends 401 if no session
      var fxaId = request.auth.credentials.fxaId;
      var offset = request.query.offset;
      var count = request.query.count;
      function renderVisits(dbVisits) {
        // TODO: transform DB output to Backbone-compatible output
        return {
          offset: offset,
          count: dbVisits.length, // count may be less than requested number
          visits: dbVisits.map(function(row) {
            return {
            };
          });
        };
      }
      db.getVisits(fxaId, offset, count, function (err, visits) {
        if (err) {
          // TODO nice error responses
          return reply.code(500);
        } 
        return reply(renderVisits(visits));
      });
    }
  }
}, {
  method: 'GET',
  path: '/',
  config: {
    auth: {
      strategy: 'session',
      mode: 'try'
    },
    plugins: { 'hapi-auth-cookie': { redirectTo: false } },
    handler: function (request, reply) {
      var page = request.auth.isAuthenticated ? 'app.html' : 'index.html';
      // TODO we should set a session cookie here that's visible to the client: #45
      reply.file(path.join(__dirname, '..', config.get('server.staticPath'), page));
    }
  }
}, {
  method: 'GET',
  path: '/auth/logout',
  handler: function (request, reply) {
    request.auth.session.clear();
    return reply.redirect('/');
  }
}, {
  method: 'GET',
  path: '/auth/complete',
  config: {
    auth: {
      strategy: 'oauth',
      mode: 'try'
    },
    handler: function (request, reply) {
      // at this point, the oauth dance is complete, we have a code but not a token.
      // we need to swap the code for the token,
      // then we need to ask the profile server for the user's profile,
      // then we need to save the session.
      // TODO: maybe we want this to live inside the server.auth.strategy call for bell?
      log.info('auth/complete invoked');
      // HUGE TODO: verify the session cookie matches the 'state' nonce in the query
      var tokenPayload = {
        client_id: config.get('server.oauth.clientId'),
        client_secret: config.get('server.oauth.clientSecret'),
        code: request.query.code
      };
      // 1. swap code for token
      wreck.post(config.get('server.oauth.tokenEndpoint'),
        { payload: JSON.stringify(tokenPayload) },
        function(err, res, payload) {
          if (err) {
            log.info('token server error: ' + err);
            // TODO something went wrong, try again? throw AppError?
            return reply.redirect('/');
          }
          if (!payload) {
            log.info('token server returned empty response');
            return reply.redirect('/');
          }
          // TODO: can Joi ensure JSON.parse doesn't throw? #43
          var pay = JSON.parse(payload);
          var accessToken = pay && pay['access_token'];
          log.debug('token server response: ' + payload);
          log.debug('token server response http code: ' + res.statusCode);
          if (!accessToken) {
            log.info('no access token found in token server response');
            return reply.redirect('/');
          }
          // 2. use the token to obtain profile data
          wreck.get(config.get('server.oauth.profileEndpoint'),
            { headers: {'authorization': 'Bearer ' + accessToken}},
            function(err, res, payload) {
              if (err) {
                log.info('profile server error: ' + err);
                return reply.redirect('/');
              }
              if (!payload) {
                log.info('profile server returned empty response');
                return reply.redirect('/');
              }
              log.info('profile server response: ' + payload);
              // TODO: can Joi ensure JSON.parse doesn't throw? #43
              var pay = JSON.parse(payload);
              db.createUser(pay.uid, pay.email, accessToken, function(err) {
                if (err) {
                  log.info('user creation failed: ' + err);
                  return reply.redirect('/');
                }
                request.auth.session.set({fxaId: payload.uid});
                reply.redirect('/');
              });
            }
          );
        }
      );
    }
  }
}, {
  // static routes using dist/, yay grunt
  method: 'GET',
  path: '/dist/{param*}',
  handler: {
    directory: {
      path: path.join(__dirname, '..', config.get('server.staticPath')),
      listing: config.get('server.staticDirListing')
    }
  }
}];
