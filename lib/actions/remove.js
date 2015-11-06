'use strict';

var colors = require('colors');
var spawn = require('child_process').spawn;
var generateHelp = require('../util/generate-help');
var isString = require('101/is-string');
var mavis = require('../util/mavis');
var options = require('../util/options');
var printf = require('printf');
var Promise = require('bluebird');

module.exports = {
  /**
   * Handles options for the remove action.
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

        /**
         * Environment Argument.
         * @param -e [name]
         * @param --env [name]
         * @default 'production'
         */
        options.set(
          'env',
          'e',
          'beta',
          '[name]=production|beta',
          'The runnable environment to query'
        );

        /**
         * Dock host argument.
         * @param --ip [hostip]
         * @param -i [hostip]
         */
        options.set(
          'ip',
          'i',
          undefined,
          '[ipaddress]',
          'The IP for the dock to remove'
        );

        /**
         * Dry run option.
         * @param --dry
         * @param -d
         * @default `null`
         */
        options.set(
          'dry',
          'd',
          undefined,
          '',
          'Perform a dry run of the provision (job is not enqueued)'
        );
      });
  },

  /**
   * Handles the specific help information for the remove action.
   * @return {Promise} A promise that resolves with the help.
   */
  help: function () {
    return generateHelp('remove', [
      'The `' + 'remove'.yellow + '` action is used remove a dock from rotation.',
      'Note: the dock will not be terminated, simply removed from build and run',
      'rotation in mavis.'
    ].join(' '))
  },

  /**
   * Executes the remove action.
   * @return {Promise} A promise that resolves with the result of the action.
   */
  execute: function () {
    return Promise
      .try(function () {
        if (!options.has('ip')) {
          throw new Error('You must specify an host ip with ' + '--ip'.cyan);
        }
        return options.get('ip');
      })
      .then(function (ip) {
        if (options.has('dry')) {
          return '';
        }
        return mavis.remove(ip);
      })
      .then(function () {
        if (options.has('dry')) {
          return '✘'.yellow + ' Dock not removed (dry)';
        }
        return '✓'.green + ' Dock removed from rotation';
      })
  }
}
