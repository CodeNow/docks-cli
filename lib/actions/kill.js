'use strict';

var aws = require('../util/aws');
var CLIError = require('../errors/cli-error');
var DryRunError = require('../errors/dry-run-error');
var generateHelp = require('../util/generate-help');
var InvalidArgumentError = require('../errors/invalid-argument-error');
var mavis = require('../util/mavis');
var options = require('../util/options');
var Promise = require('bluebird');
var question = require('../util/question');
var readline = require('readline');

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
          'id',
          'i',
          undefined,
          '',
          'The id of the instance to kill.'
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
   * Handles the specific help information for the kill action.
   * @return {Promise} A promise that resolves with the help.
   */
  help: function () {
    return generateHelp({
      name: 'kill',
      description: [
        'The `' + 'kill'.yellow + '` action will terminate a dock with the ',
        'given AWS instance id and remove it from rotation in mavis.'
      ].join(' ')
    });
  },

  /**
   * Executes the kill action.
   * @return {Promise} A promise that resolves with the result of the action.
   */
  execute: function () {
    return Promise
      .try(function() {
        if (!options.has('id')) {
          throw new InvalidArgumentError(
            'You must specifiy an instance id with ' + '--id'.cyan
          );
        }
        return aws.list(options.get('id'));
      })
      .then(function (instances) {
        if (instances.length !== 1) {
          throw new CLIError(
            'Could not find ' + options.get('env') + ' dock with id ' +
            options.get('id').cyan
          );
        }
        if (instances[0].State.Name === 'terminated') {
          throw new CLIError(
            'Instance ' + options.get('id') + ' has already been terminated.'
          );
        }
        return instances[0].PrivateIpAddress;
      })
      .then(function (ip) {
        return question.yesno(
          'Are you sure you wish to kill ' + options.get('id').cyan + '?',
          'Dock kill aborted'
        ).then(function () {
          return ip;
        });
      })
      .then(function (ip) {
        return mavis.remove(ip);
      })
      .then(function () {
        return aws.terminate(options.get('id'));
      })
      .then(function () {
        return '✓'.green + ' Dock ' + 'Slaughtered'.red;
      })
      .catch(function (err) {
        if (err.code === 'DryRunOperation') {
          throw new DryRunError('Dock Not Killed');
        }
        throw err;
      });
  }
};
