/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var fs = require('fs');
var path = require('path');

var convict = require('convict');
const SEVEN_DAYS_IN_MSEC = 1000 * 60 * 60 * 24 * 7;

var conf = convict({
  env: {
    doc: 'Application environment.',
    format: ['local', 'awsdev', 'prod', 'test'],
    default: 'local',
    env: 'NODE_ENV'
  },
  db: {
    elasticsearch: {
      host: {
        default: '127.0.0.1',
        env: 'ES_HOST'
      },
      port: {
        default: 9200,
        env: 'ES_PORT'
      }
    },
    mysql: {
      host: {
        default: '127.0.0.1',
        env: 'MYSQL_HOST'
      },
      port: {
        default: 3306,
        env: 'MYSQL_PORT'
      },
      user: {
        default: 'root',
        env: 'MYSQL_USERNAME'
      },
      password: {
        default: '',
        env: 'MYSQL_PASSWORD'
      }
    },
    redis: {
      host: {
        default: '127.0.0.1',
        env: 'REDIS_HOST'
      },
      port: {
        default: 6379,
        env: 'REDIS_PORT'
      }
    }
  },
  server: {
    log: {
      doc: 'Mozlog configuration. Defaults currently target dev, not prod.',
      app: {
        doc: 'Top-level app name used in hierarchical logging, for example, "chronicle.db.mysql"',
        default: 'chronicle'
      },
      level: {
        doc: 'Log messages with this or greater log level. Levels, in order, are: ' +
             'trace, verbose, debug, info, warn, error, critical.',
        default: 'debug'
      },
      fmt: {
        doc: 'Formatter. Use pretty for local dev, heka for production',
        default: 'pretty'
      },
      debug: {
        doc: 'Extra checks that logger invocations are correct. Useful when developing',
        default: true
      }
    },
    host: {
      doc: 'Host for the main api server process.',
      default: '127.0.0.1',
      env: 'HOST'
    },
    port: {
      doc: 'Port for the main api server process.',
      default: 8080,
      env: 'PORT'
    },
    staticPath: {
      doc: 'Path to static files.',
      default: 'dist',
      env: 'STATIC_PATH'
    },
    staticDirListing: {
      doc: 'Whether to allow directory listings for static dirs.',
      default: false,
      env: 'STATIC_DIR_LISTING'
    },
    oauth: {
      clientId: {
        doc: 'Firefox Accounts client_id.',
        default: '5901bd09376fadaa',
        env: 'FXA_OAUTH_CLIENT_ID'
      },
      clientSecret: {
        doc: 'Firefox Accounts OAuth client_secret.',
        default: '4ab433e31ef3a7cf7c20590f047987922b5c9ceb1faff56f0f8164df053dd94c',
        env: 'FXA_OAUTH_CLIENT_SECRET'
      }
    },
    session: {
      password: {
        doc: 'Password used to encrypt cookies with hueniverse-iron.',
        default: 'S3kr1t',
        env: 'SESSION_PASSWORD'
      },
      isSecure: {
        doc: 'Whether to allow cookie to be transmitted over insecure connections.',
        default: false,
        env: 'ALLOW_HTTP_COOKIES'
      },
      duration: {
        doc: 'Default session TTL for authenticated users.',
        default: SEVEN_DAYS_IN_MSEC,
        env: 'SESSION_DURATION'
      }
    }
  }
});

// TODO: copypasta from fxa-oauth-server. extract into a module? add to convict?
var envConfig = path.join(__dirname, '..', 'config', conf.get('env') + '.json');
var files = (envConfig + ',' + process.env.CONFIG_FILES)
  .split(',').filter(fs.existsSync);
conf.loadFile(files);
conf.validate();
module.exports = conf;
