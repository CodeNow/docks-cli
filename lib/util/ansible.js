'use strict';

var childProcess = require('child_process');
var exists = require('101/exists');
var isEmpty = require('101/is-empty');
var isString = require('101/is-string');
var options = require('./options');
var path = require('path');
var Promise = require('bluebird');
var execAsync = Promise.promisify(childProcess.exec);

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
   * Gets the path to the specific ansible variables file depending on the
   * 'env' option.
   * @return {string} The path to the variables file.
   */
  getSearchPath: function () {
    return path.resolve(
      process.env.DEVOPS_SCRIPTS_PATH,
      'ansible',
      (options.get('env') === 'production') ? 'prod-hosts' : 'beta-hosts' : 'gamma-hosts' ,
      'variables'
    );
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
  get: function (name) {
    if (!this.hasDevopsScriptsPath()) {
      return Promise.reject(new Error('Missing `DEVOPS_SCRIPTS_PATH` env.'));
    }

    var command = ['grep \'', name, '\' ', this.getSearchPath()].join('');
    return execAsync(command)
      .then(function (result) {
        var match = result.toString()
          .match( new RegExp('^\\s*' + name + '\\s*=\\s*(.+)\\s*$') );
        if (!match) {
          throw new Error('Variable not found: ' + name);
        }
        return match[1];
      });
  },

  /**
   * Fetches variables with all given names and resolves with an object
   * that maps the variable name to its value in the devops-scripts variables
   * file.
   */
  all: function (name) {
    if (!this.hasDevopsScriptsPath()) {
      return Promise.reject(new Error('Missing `DEVOPS_SCRIPTS_PATH` env.'));
    }

    var names = [];
    if (isString(name)) {
      names = Array.prototype.slice.call(arguments);
    }
    else if (Array.isArray(name)) {
      names = name;
    }

    var searchPattern = '\'' + names.join('|') + '\'';
    var command = [
      'grep -E ',
      searchPattern,
      ' ',
      this.getSearchPath()
    ].join('');
    return execAsync(command)
      .then(function (result) {
        var variableMap = {};
        var lines = result.toString().split('\n');
        names.forEach(function (name) {
          lines.forEach(function (line) {
            var match = line.match(new RegExp(name + '=([^\n]+)'));
            if (match) {
              variableMap[name] = match[1];
            }
          });
          if (!variableMap[name]) {
            throw new Error('Variable not found: ' + name);
          }
        });
        return variableMap;
      })
  }
};
