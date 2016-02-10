'use strict'

var DryRunError = require('../errors/dry-run-error')
var generateHelp = require('../util/generate-help')
var InvalidArgumentError = require('../errors/invalid-argument-error')
var mavis = require('../util/mavis')
var options = require('../util/options')
var Promise = require('bluebird')

module.exports = {
  /**
   * Handles options for the remove action.
   * @return {Promise} A promise that resolves once options have been set.
   */
  options: function () {
    return Promise
      .try(function () {
        options.set(
          'ip',
          'i',
          undefined,
          '[ipaddress]',
          'The IP for the dock to remove'
        )

        options.set(
          'dry',
          'd',
          undefined,
          '',
          'Perform a dry run of the provision (job is not enqueued)'
        )
      })
  },

  /**
   * Handles the specific help information for the remove action.
   * @return {Promise} A promise that resolves with the help.
   */
  help: function () {
    return generateHelp({
      name: 'remove',
      description: [
        'The `' + 'remove'.yellow + '` action is used remove a dock from rotation.',
        'Note: the dock will not be terminated, simply removed from build and run',
        'rotation in mavis.'
      ].join(' ')
    })
  },

  /**
   * Executes the remove action.
   * @return {Promise} A promise that resolves with the result of the action.
   */
  execute: function () {
    return Promise
      .try(function () {
        if (!options.has('ip')) {
          throw new InvalidArgumentError(
            'You must specify an host ip with ' + '--ip'.cyan
          )
        }
        return options.get('ip')
      })
      .then(function (ip) {
        if (options.has('dry')) {
          throw new DryRunError('Dock not removed')
        }
        return mavis.remove(ip)
      })
      .then(function () {
        return '✓'.green + ' Dock removed from rotation'
      })
  }
}
