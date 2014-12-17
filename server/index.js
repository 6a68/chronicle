/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var Hapi = require('hapi');
var path = require('path');
var config = require('./config');
var log = require('./logger')('server.index');
var routes = require('./routes');

var server = new Hapi.Server({ debug: { request: ['error'] } });
server.connection({
  host: config.get('server.host'),
  port: config.get('server.port')
});

server.register([require('hapi-auth-cookie'), require('bell')], function (err) {
  if (err) {
    log.warn('failed to load plugin: ' + err);
    throw err; // TODO: should we use AppError instead?
  }

  // hapi-auth-cookie init
  // TODO: when we really have to, move this crap into a config file
  server.auth.strategy('session', 'cookie', {
    password: 'cookie_encryption_password',
    cookie: 'sid-chronicle',
    redirectTo: '/',
    isSecure: false, 
    ttl: 1000 * 60 * 60 * 24 * 7
  });

  // bell init
  // TODO move into a config file only when we actually have to 
  server.auth.strategy('oauth', 'bell', {
    provider: {
      protocol: 'oauth2',
      auth: 'https://oauth-latest.dev.lcip.org/v1/authorization',
      token: 'https://oauth-latest.dev.lcip.org/v1/token',
      version: '2.0',
      scope: ['chronicle','profile'],
      profile: function (credentials, params, get, profileCb) {
        throw new Error('inside bell provider profile function');
        log.info('inside the oauth-bell profile callback!');
        log.info('credentials: ' + credentials);
        log.info('params: ' + JSON.stringify(params));
        log.info('get: ' + get);
        log.info('profileCb: ' + profileCb);
        // TODO here's a guess at what to do in here, bell provides no example:
        // 1. grab params.token, send it to the profile endpoint
        // 2. put the profile response into the credentials object, then send it to DB
      }
    },
    password: 'cookie_encryption_password',
    clientId: '1f9bbddcb3e160ab',
    clientSecret: '24bf8caeaa685e2e42d9a75b48511f83adffaf6fcdd174ce8749358a376be911',
    isSecure: false
  });

  server.route(routes);
  server.start(function (err) {
    if (err) {
      log.warn('server failed to start: ' + err);
      throw err; // TODO: should we fail to start in some other way? AppError?
    }
    log.info('chronicle server running on port ' + config.get('server.port'));
  });
});
