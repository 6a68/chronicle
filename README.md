# Chronicle

find everything you've ever found

[![Build Status: Travis](https://travis-ci.org/mozilla/chronicle.svg?branch=master)](https://travis-ci.org/mozilla/chronicle)

## Installation

### Large Tools

Chronicle is built using [Node.js](https://nodejs.org/), [ElasticSearch](https://www.elasticsearch.org/), [MySQL](https://www.mysql.com/), and [Redis](http://redis.io/), so you'll want to install the current stable version of all of these.

If you are using Mac OS and have [Homebrew](http://brew.sh/) installed, this incantation should work:

```sh
$ brew install nodejs elasticsearch mysql redis
```

### Code

The server-side code dependencies are managed with [npm](https://www.npmjs.com/) and requires that [Grunt](http://gruntjs.com/) is globally installed (`npm install -g grunt-cli`). The front-end dependencies are managed with [Bower](https://bower.io/); you can install it via `npm install -g bower` if you don't have it on your system.

To fetch dependencies and get cooking:

1. `npm install`
2. As part of the npm install process, the `postinstall` script will install the Bower dependencies for you.
3. Copy `config/local.json.example` to `config/local.json`, and put your local info in there.
4. `npm start`
5. You're up and running! surf to <http://localhost:8080> :surfer:


### Available Grunt Tasks

| Name | Description |
|------|-------------|
| `autoprefixer` | Adds vendor prefixes to CSS files based on <http://caniuse.com> statistics.
| `build` | Build front-end assets and copy them to dist.
| `changelog` | Generate a changelog from git metadata.
| `clean` | Deletes files and folders.
| `contributors` | Generates a list of contributors from your project's git history.
| `copy` | Copies files and folders.
| `copyright` | Checks for MPL copyright headers in source files.
| `css` | Alias for "sass", "autoprefixer" tasks.
| `hapi` | Starts the hapi server.
| `jscs` | JavaScript Code Style checker.
| `jshint` | Validates files with JSHint.
| `jsonlint` | Validates JSON files.
| `lint` | Alias for "jshint", "jscs", "jsonlint", "copyright" tasks.
| `sass` | Compiles Sass files to vanilla CSS.
| `serve` | Alias for "hapi", "build", and "watch" tasks.
| `validate-shrinkwrap` | Submits your _npm-shrinkwrap.json_ file to <https://nodesecurity.io> for validation.
| `watch` | Runs predefined tasks whenever watched files change.


### npm Scripts

| Name | Description |
|------|-------------|
| `authors` | Alias for `grunt contributors` Grunt task.
| `lint` | Alias for `grunt lint` Grunt task. This task gets run during the [precommit](https://www.npmjs.com/package/precommit-hook) Git hook.
| `outdated` | Alias for `npm outdated --depth 0` to list top-level outdated modules in your package.json file. For more information, see <https://docs.npmjs.com/cli/outdated>.
| `postinstall` | Runs after the package is installed, and automatically installs/updates the Bower dependencies.
| `shrinkwrap` | Alias for `npm shrinkwrap --dev` and `npm run validate` to generate and validate npm-shrinkwrap.json file (including devDependencies).
| `start` | Runs `grunt serve`.
| `test` | Runs unit and functional tests.
| `validate` | Alias for `grunt validate-shrinkwrap` task (ignoring any errors which may be reported).

### Creating Dummy Data

If you just want to test something quickly with a small, known test data set:

1. run `server/db/create_db.js` to drop and re-create the local mysql db
2. To enable test data, ensure the `testUser.enabled` config option is set in `config/local.json`.
  - You can use the default id and email (defined in `server/config.js`), or set them yourself.
    You can set the values via env vars or config values.
    See `server/config.js` for the defaults and which config values or env vars to use.
3. run `server/db/create_test_data.js` to create a dummy user and a few dummy visits.
  - The number of records to create is configurable; invoke it with `--help` for details.

## Learn More
* Tumblr: http://mozillachronicle.tumblr.com/
* IRC channel: #chronicle on mozilla IRC
* Mailing list: chronicle-dev@mozilla.org (https://mail.mozilla.org/listinfo/chronicle-dev)
