'use strict'

var CLIError = require('../errors/cli-error')
var generateHelp = require('../util/generate-help')
var InvalidArgumentError = require('../errors/invalid-argument-error')
var mavis = require('../util/mavis')
var options = require('../util/options')
var Promise = require('bluebird')
var rabbit = require('../util/rabbit')
var readline = require('readline')

/**
 * Action that marks docks as unhealthy.
 * @module docks-cli:actions:unhealthy
 */
module.exports = {
  /**
   * Sets options for the unhealthy action.
   * @return {Promise} Resolves after the options have been set.
   */
  options: function () {
    options.set(
      'ip',
      'i',
      undefined,
      '[ipaddress]',
      'The IP for the dock to mark as unhealthy'
    )

    options.set(
      'force',
      'f',
      undefined,
      '',
      'Force job to be enqueued'
    )

    options.set(
      'dry',
      'd',
      undefined,
      '',
      'Perform a dry run of the provision (job is not enqueued)'
    )
  },

  /**
   * Help for the unhealthy action.
   * @return {Promise} Resolves with the help for this action.
   */
  help: function () {
    return generateHelp({
      name: 'unhealthy',
      description: [
        'The `' + 'unhealthy'.yellow + '` action marks active docks as',
        'unhealthy and in need of replacement in the infrastructure.',
        'Note that this is a convience method that only enqueues the ',
        'on-dock-unhealthy job and then exits. It can take up',
        'to ten minutes for the replacement dock to appear in the `',
        'list'.yellow, '`.'
      ].join(' ')
    })
  },

  /**
   * Executes the provision action.
   * @return {Promise} Resolves after the dock provision has been initiated.
   */
  execute: function () {
    return Promise
      .try(function () {
        if (!options.has('ip')) {
          throw new InvalidArgumentError(
            'You must specify an host ip with ' + '--ip'.cyan
          )
        }
        return mavis.list()
      })
      .then(function (docks) {
        var dock = docks.find(function (dock) {
          return dock.ip === options.get('ip')
        })

        if (!dock && !options.get('force')) {
          throw new CLIError(
            'Dock with host ip ' + options.get('ip').cyan + ' not found.'
          )
        }

        return dock.org
      })
      .then(function (org) {
        if (!options.has('dry')) {
          var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          })
          var question = [
            'Are you sure you wish to mark ', options.get('ip').cyan,
            ' as unhealthy for org ', org.toString().yellow, '? [y/N]: '
          ].join('')

          return new Promise(function (resolve, reject) {
            rl.question(question, function (answer) {
              rl.close()
              if (answer.charAt(0).toLowerCase() !== 'y') {
                reject(new Error('Aborted dock unhealthy'))
              }
              resolve(org)
            })
          })
        } else {
          return org
        }
      })
      .then(function (org) {
        return rabbit.publish('on-dock-unhealthy', {
          host: 'http://' + options.get('ip').toString() + ':4242',
          githubId: org.toString()
        })
      })
  }
}
