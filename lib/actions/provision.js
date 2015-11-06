'use strict';

var colors = require('colors');
var generateHelp = require('../util/generate-help');
var options = require('../util/options');
var Promise = require('bluebird');
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
        'env',
        'e',
        'beta',
        '[name]=production|beta',
        'The runnable EC2 environment into which the dock will be provisioned.'
      );

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
          throw new Error('You must specify an org id with ' + '--org'.cyan);
        }
      })
      .then(function () {
        if (!options.has('dry')) {
          var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          var question = [
            'Are you sure you wish to provision a new ',
            options.get('env').yellow,
            ' dock for org ', options.get('org').toString().cyan, '? [y/N]: '
          ].join('');

          return new Promise(function (resolve, reject) {
            rl.question(question, function (answer) {
              rl.close();
              if (answer.charAt(0).toLowerCase() !== 'y') {
                reject(new Error('Aborted instance provisioning'));
              }
              resolve();
            });
          });
        }
      })
      .then(function () {
        return rabbit.publish('cluster-instance-provision', {
          githubId: options.get('org').toString()
        });
      });
  }
};
