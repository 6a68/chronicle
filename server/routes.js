/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var path = require('path');
var wreck = require('wreck');
var uuid = require('uuid');

var log = require('./logger')('server.routes');
var config = require('./config');
var db = require('./db/db');

module.exports = [{
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
      // TODO we should set a session cookie here that's visible to the client
      reply.file(path.join(__dirname, '../app', page));
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
          var pay = JSON.parse(payload);
          var accessToken = pay && pay['access_token'];
          log.debug('token server response: ' + payload);
          log.debug('token server response http code: ' + res.statusCode);
          if (!accessToken) {
            log.info('no access token found in token server response');
            return reply.redirect('/');
          }
          // 2. use the token to obtain profile data
          wreck.get(config.get('server.oauth.profileUri'),
            { headers: {'authorization': 'Bearer ' + accessToken}},
            function(err, res, payload) {
              if (err) { log.info('profile server error: ' + err) }
              if (!payload) { log.info('profile server returned empty response') }
              log.info('profile server response: ' + payload);
              var pay = JSON.parse(payload);
              db.createUser(pay.uid, pay.email, accessToken, function(err) {
                if (err) {
                  // TODO DB write failed, what to do?
                }
                request.auth.session.set({fxaId: payload.uid});
                reply.redirect('/');
              });
          });
      });
    }
  }
}, {
  // static routes using dist/, yay grunt
  method: 'GET',
  path: '/dist/{param*}',
  handler: {
    // TODO use hapi configs before going to production :-P
    directory: {
      path: path.join(__dirname, '../app'),
      listing: true
    }
  }
}];
