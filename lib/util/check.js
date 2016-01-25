'use strict';

var childProcess = require('child_process');
var exists = require('101/exists');
var isEmpty = require('101/is-empty');
var isString = require('101/is-string');
var options = require('./options');
var path = require('path');
var Promise = require('bluebird');
var execAsync = Promise.promisify(childProcess.exec);
var notifier = require('node-notifier');

/**
 * Module for querying devops-scripts repository variables files to find
 * specific information (hosts, passwords, etc.) without having to store them
 * locally to the CLI application.
 * @module docks-cli:util:ansible
 */
module.exports = {
  /**
   * Determines if the `process.env.DEVOPS_SCRIPTS_PATH` is set.
   * @return `true` if the path is set, `false` otherwise.
   */
  hasDevopsScriptsPath: function () {
    var path = process.env.DEVOPS_SCRIPTS_PATH;
    return exists(path) && !isEmpty(path);
  },

  /**
   * Gets a variable value from the local devops-scripts repository for a given
   * name. Basically this will just grep the *-hosts/variables file for the
   * name and resolve with whatever is to the right of the `=` sign. If a
   * variable with the given name could not be found then this method will
   * reject with an error.
   * @param {string} name Name of the variable to fetch.
   * @return {Promise} A promise that resolves with the value for the variable
   *   or rejects if the variable could not be found.
   */
  devopsScripts: function () {
    if (!this.hasDevopsScriptsPath()) {
      return Promise.reject(new Error('Missing `DEVOPS_SCRIPTS_PATH` env.'))
    }

    var command = ['cd ', process.env.DEVOPS_SCRIPTS_PATH, ';',
      'git rev-list HEAD...origin/master --count'].join('')
    return execAsync(command)
      .then(function (result) {
        var commits = result.trim();
        return commits === '0'
      }).then(function (isUpdated) {
        if (!isUpdated) {
          notifier.notify({
            'title': 'Docks CLI',
            'message': 'Please update your version of Docks CLI'
          });
        }
        return;
      });
  },
};
