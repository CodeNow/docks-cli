'use strict';

var colors = require('colors');
var printf = require('printf');
var Promise = require('bluebird');

/**
 * Generates the cli actions help text.
 * @return {string} The help text that describes each of the CLI's actions.
 */
function actionsHelp() {
  var actions = require('./'); // require here because of circular reference
  var allActions = actions.all();
  var actionNames = Object.keys(allActions);
  var maxActionLength = actionNames.reduce(function (max, name) {
    return name.length > max ? name.length : max;
  }, 0);

  var preamble = 'Usage: ' + 'docks'.magenta + ' <action>'.yellow +
    ' [options...]'.cyan.italic + '\n\nActions:\n';
    
  return preamble + actionNames.map(function (name) {
    return printf('    %-' + maxActionLength + 's', name).yellow +
      ' - ' + actions.get(name).help;
  }).join('\n') + '\n';
}

/**
 * The master help action. Lists all actions with brief descriptions.
 * @module docks-cli:actions
 */
module.exports = {
  /**
   * Handles options for the help action.
   * @return {Promise} A promise that resolves once options have been set.
   */
  options: function () {
    return Promise.resolve();
  },

  /**
   * Handles the specific help information for the help action.
   * @return {Promise} A promise that resolves with the help.
   */
  help: function () {
    return Promise.resolve(actionsHelp());
  },

  /**
   * Executes the help action.
   * @return {Promise} A promise that resolves with the result of the action.
   */
  execute: function () {
    return Promise.resolve(actionsHelp());
  }
};
