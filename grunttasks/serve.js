/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

module.exports = function (grunt) {
  'use strict';

  grunt.registerTask('serve', 'Builds the dist assets, starts the Hapi server, and watches for changes.', function (target) {
    if (!target) {
      target = 'development';
    }

    grunt.task.run([
      'build:' + target,
      'hapi',
      'watch'
    ]);
  });
};
