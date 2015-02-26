/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

var q = require('q');
var uuid = require('uuid');

var postgres = require('../db/postgres');
var elasticsearch = require('../db/elasticsearch');
var log = require('../logger')('server.models.visit');

var _verbose = function() {
  var logline = [].join.call(arguments, ', ');
  log.verbose(logline);
};

var visit = {
  _onFulfilled: function _onFulfilled(msg, callback, results) {
    _verbose(msg);
    callback(null, results);
  },
  _onRejected: function _onRejected(msg, callback, err) {
    log.warn(msg);
    callback(err);
  },
  // this just got uglier due to the possibility of non-camelized results.
  // TODO make this function unnecessary by altering the schema or queries.. too tricky.
  _transform: function _transform(results) {
    // do a little transformin' and this might barf, so do it before `done`

    // if nothing was found, continue
    if (!results) { return; }

    // this is to work around our laziness in SELECT * above
    results.id = results.visitId;
    delete results.visitId;

    return results;
  },
  // 1. find a complex way to combine both queries on the DB side
  // 2. (simpler) perform two simple queries and roll them together here
  get: function(userId, id, cb) {
    var name = 'models.visit.get';
    _verbose(name + ' called', userId, id);
    // it's actually way simpler to SELECT *, and re-select additional columns,
    // vs enumerating everything just to avoid two 'id's in the results.
    var query = 'SELECT visits.id as visit_id, visits.user_id as user_id, * ' +
    'FROM visits LEFT JOIN user_pages ON visits.user_page_id = user_pages.id ' +
    'WHERE visits.id = $1 AND visits.user_id = $2';
    var params = [id, userId];
    postgres.query(query, params)
      .then(function(results) {
        // return a promise that resolves to the transformed results
        return q(visit._transform(results));
      })
      .done(visit._onFulfilled.bind(visit, name + ' succeeded', cb),
            visit._onRejected.bind(visit, name + ' failed', cb));
  },
  // TODO: for right now, doing an exact match on urlHash, visitedAt.
  // We might want to look in a neighborhood of those values later, in which
  // case we'd need a similarity metric for the url.
  create: function(userId, id, visitedAt, url, urlHash, title, cb) {
    // XXX we create only a few user_page fields synchronously; the rest
    // are filled in async by the scraper worker
    var name = 'models.visit.create';
    _verbose(name + ' called', userId, id, visitedAt, url, title);
    // create the user_page if it doesn't exist, and return the user_page id
    // whether or not you just created it
    var lazyCreateUserPageQuery =
      'WITH new_page AS (  ' +
      '  INSERT INTO user_pages (id, user_id, url, raw_url, url_hash, title, created_at, updated_at) ' +
      '  SELECT $1, $2, $3, $3, $4, $5, $6, $6 ' +
      '  WHERE NOT EXISTS (SELECT id FROM user_pages WHERE user_id = $2 AND url_hash = $4) ' +
      '  RETURNING id ' +
      ') SELECT id FROM new_page ' +
      'UNION SELECT id FROM user_pages WHERE user_id = $2 AND url_hash = $4';
    var lazyCreateParams = [uuid.v4(), userId, url, urlHash, title, new Date().toJSON()];
    var createVisitQuery = 'INSERT INTO visits ' +
      '(id, user_id, user_page_id, visited_at, updated_at) ' +
      'VALUES ($1, $2, $3, $4, $4)';
    var noCamel = true; // don't camelize returned results; keeps ES just like PG
    var userPageId;

    // 1. either fetch the userPageId, or create the page and return the id
    // 2. create the visit
    // 3. fetch the userPage from postgres and insert into elasticsearch
    //    - this could probably be optimized to make 1 fewer postgres queries,
    //      but this code is already embarrassingly overoptimized
    postgres.query(lazyCreateUserPageQuery, lazyCreateParams, noCamel)
      .fail(visit._onRejected.bind(visit, name + ' failed', cb))
      .then(function(results) {
        userPageId = results && results.id;
        var visitParams = [id, userId, userPageId, visitedAt];
        return postgres.query(createVisitQuery, visitParams, noCamel);
      })
      .fail(visit._onRejected.bind(visit, name + ' postgres insert failed', cb))
      .then(function() {
        return postgres.query('SELECT * FROM user_pages WHERE id = $1', [userPageId], noCamel);
      })
      .then(function(result) {
        var esQuery = {
          index: 'chronicle',
          type: 'user_pages',
          id: userPageId,
          // NOTE: we are inserting the PG record directly, for simplicity's sake.
          body: result
        };
        // if the scraper elasticsearch task happens first, this one will abort, to avoid
        // overwriting all the scraped data with nothing
        return elasticsearch.query('create', esQuery);
      })
      .done(visit._onFulfilled.bind(visit, name + ' succeeded', cb),
            visit._onRejected.bind(visit, name + ' elasticsearch insert failed', cb));
  },
  delete: function(userId, id, cb) {
    // delete the visit if it exists.
    // delete the visit's userPage if no other visits have that page.
    var name = 'models.visit.delete';
    var userPageId;
    postgres.query('DELETE FROM visits WHERE user_id = $1 AND id = $2 RETURNING user_page_id', [userId, id])
      .fail(visit._onRejected.bind(visit, name + ' failed to delete visit', cb))
      .then(function(result) {
        _verbose('delete returning result gives us: ' + JSON.stringify(result));
        userPageId = result.userPageId;
        return postgres.query('SELECT count(*) FROM visits WHERE user_id = $1 AND user_page_id = $2',
        [userId, userPageId]);
      })
      .fail(visit._onRejected.bind(visit, name + ' failed to count visits having a page', cb))
      .done(function(result) {
        var count = result && parseInt(result.count, 10);
        // non-numbers will be coerced to NaN by parseInt, which is typeof 'number', lol
        // note that if result is undefined, count will be, too, and isNaN(undefined) is true.
        if (isNaN(count)) {
          log.warn('attempting to count remaining visits sharing a user_page failed to return a numeric count, count was ' + count);
          visit._onRejected(name + ' failed to return a count of visits sharing a user_page', cb, null);
        } else if (count > 0) {
          // nothing more to do here; call _onFulfilled.
          // todo: does this ensure the promise chain ends?
          visit._onFulfilled(name + ' succeeded', cb, null);
        } else {
          _verbose('no other visits exist for user page ' + userPageId + ': deleting it');
          var deleteQuery = 'DELETE FROM user_pages WHERE user_id = $1 AND id = $2';
          // TODO I really dislike nesting promises like this. We should split this user_page cleanup
          // out into a separate method.
          postgres.query(deleteQuery, [userId, userPageId])
            .then(elasticsearch.query('delete', {index: 'chronicle', type: 'user_pages', id: userPageId}))
            .done(visit._onFulfilled.bind(visit, name + ' succeeded', cb, null),
                  visit._onRejected.bind(visit, name + ' failed', cb));
        }
      }, visit._onRejected.bind(visit, name + ' failed', cb));
  }
};

module.exports = visit;
