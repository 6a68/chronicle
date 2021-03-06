/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

module.exports = function (grunt) {
  'use strict';

  grunt.config('watch', {
    config: {
      files: ['Gruntfile.js', 'grunttasks/*'],
      tasks: ['build'],
      options: {
        reload: true
      }
    },
    build: {
      files: ['app/**/*'],
      tasks: ['build']
    },
    hapi: {
      files: ['server/**/*'],
      tasks: ['hapi'],
      options: {
        spawn: false
      }
    },
    livereload: {
      // Watch for file changes in dist to trigger livereload
      files: ['dist/**/*'],
      options: {
        livereload: true
      }
    }
  });
};
