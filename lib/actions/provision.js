'use strict';

var CLIError = require('../errors/cli-error');
var generateHelp = require('../util/generate-help');
var InvalidArgumentError = require('../errors/invalid-argument-error');
var options = require('../util/options');
var printf = require('printf');
var Promise = require('bluebird');
var question = require('../util/question');
var rabbit = require('../util/rabbit');
var readline = require('readline');

/**
 * Action for provisioning new customer docks.
 * @module docks-cli:actions:provision
 */
module.exports = {
  /**
   * Sets options for the provision action.
   * @return {Promise} Resolves after the options have been set.
   */
  options: function () {
    return Promise.try(function () {
      options.set(
        'org',
        'o',
        undefined,
        '[org-id]',
        'Organization for which to provision the dock.'
      );

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
   * Help for the provision action.
   * @return {Promise} Resolves with the help for this action.
   */
  help: function () {
    return generateHelp('provision', [
      'The `' + 'provision'.yellow + '` action provisions a new EC2 dock',
      'instance for an organization. Note that this is a convience method',
      'that only enqueues the provisioning job and then exits. It can take up',
      'to ten minutes for the dock to appear in the `' + 'list'.yellow + '`',
      'with the correct organization id.'
    ].join(' '))
  },

  /**
   * Executes the provision action.
   * @return {Promise} Resolves after the dock provision has been initiated.
   */
  execute: function () {
    return Promise
      .try(function () {
        if (!options.has('org')) {
          throw new InvalidArgumentError(
            'You must specify an org id with ' + '--org'.cyan
          );
        }
      })
      .then(function () {
        return question.yesno(
          printf(
            'Are you sure you wish to provision a new %s dock for org %s?',
            options.get('env').yellow,
            options.get('org').toString().cyan
          ),
          'Aborted instance provisioning'
        );
      })
      .then(function () {
        return rabbit.publish('cluster-instance-provision', {
          githubId: options.get('org').toString()
        });
      });
  }
};
