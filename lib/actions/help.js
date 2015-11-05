'use strict';

var colors = require('colors');
var generateHelp = require('../util/generate-help');
var options = require('../util/options');
var printf = require('printf');
var Promise = require('bluebird');

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
    return Promise
      .try(function () {
        /**
         * Help Argument.
         * @param -h
         * @param --help
         * @default null
         */
        options.set(
          'help',
          'h',
          undefined,
          '',
          'Displays this argument help message.'
        );
      });
  },

  /**
   * Handles the specific help information for the help action.
   * @return {Promise} A promise that resolves with the help.
   */
  help: function () {
    return generateHelp('help', [
      'The `' + 'help'.yellow + '` action describes the basic workings of all ',
      'other cli actions. For more detailed help on a specific action use the ',
      '`' + '-h'.cyan + '` option when executing the action. For example, ',
      'running `docks list -h` will display the specific help for the `list`',
      'action.'
    ].join(' '))
  },

  /**
   * Executes the help action.
   * @return {Promise} A promise that resolves with the result of the action.
   */
  execute: function () {
    var actions = require('./'); // require here because of circular reference
    var allActions = actions.all();
    var actionNames = Object.keys(allActions);
    var maxActionLength = actionNames.reduce(function (max, name) {
      return name.length > max ? name.length : max;
    }, 0);

    var preamble = 'Usage: ' + 'docks'.magenta + ' <action>'.yellow +
      ' [options...]'.cyan.italic + '\n\nActions:\n';

    var helpText = preamble + actionNames.map(function (name) {
      return printf('    %-' + maxActionLength + 's', name).yellow +
        ' - ' + actions.get(name).help;
    }).join('\n') + '\n';

    return Promise.resolve(helpText);
  }
};
