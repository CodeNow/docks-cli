'use strict'

var generateHelp = require('../util/generate-help')
var InvalidArgumentError = require('../errors/invalid-argument-error')
var options = require('../util/options')
var Promise = require('bluebird')
var question = require('../util/question')
var rabbit = require('../util/rabbit')

/**
 * Terminates docks and ensures they are removed from rotation.
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
        options.set(
          'ip',
          'i',
          undefined,
          '',
          'The ip of the instance to kill.'
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
   * Handles the specific help information for the kill action.
   * @return {Promise} A promise that resolves with the help.
   */
  help: function () {
    return generateHelp({
      name: 'kill',
      description: [
        'The `' + 'kill'.yellow + '` action will terminate a dock with the ',
        'given AWS private ip and remove it from rotation in mavis.'
      ].join(' ')
    })
  },

  /**
   * Executes the kill action.
   * @return {Promise} A promise that resolves with the result of the action.
   */
  execute: function () {
    return Promise
      .try(function () {
        if (!options.has('ip')) {
          throw new InvalidArgumentError(
            'You must specifiy an instance id with ' + '--ip'.cyan
          )
        }
        var ip = options.get('ip')

        var killAbortMessage = 'Aborted dock destruction'

        var killWarning = [
          ':bangbang: :bangbang: '.emoji,
          'UNHEALTHY will KILL the dock.',
          ':bangbang: :bangbang: '.emoji,
          'Are you SURE you want to KILL the dock with ip',
          ip.cyan
        ].join(' ')

        return question.yesno(
          killWarning,
          killAbortMessage
        ).then(function () {
          return question.yesno(
            'Are you sure you wish to kill the dock with ip ' + ip.cyan,
            killAbortMessage
          )
        })
      })
      .then(function () {
        return rabbit.publish('asg.instance.terminate', {
          ipAddress: options.get('ip')
        })
      })
  }
}
