'use strict';

var aws = require('../util/aws');
var colors = require('colors');
var generateHelp = require('../util/generate-help');
var mavis = require('../util/mavis');
var options = require('../util/options');
var Promise = require('bluebird');
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
          'help',
          'h',
          undefined,
          '',
          'Displays this argument help message.'
        );

        options.set(
          'env',
          'e',
          'beta',
          '[name]=production|beta',
          'The runnable environment to query'
        );

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
    return generateHelp('help', [
      'The `' + 'kill'.yellow + '` action will terminate a dock with the given ',
      'AWS instance id and remove it from rotation in mavis.'
    ].join(' '))
  },

  /**
   * Executes the kill action.
   * @return {Promise} A promise that resolves with the result of the action.
   */
  execute: function () {
    return Promise
      .try(function() {
        if (!options.has('id')) {
          throw new Error(
            'You must specifiy an instance id with ' + '--id'.cyan
          );
        }
        return aws.list(options.get('id'));
      })
      .then(function (instances) {
        if (instances.length !== 1) {
          throw new Error(
            'Could not find ' + options.get('env').cyan + ' dock with id ' +
            options.get('id').cyan
          );
        }
        if (instances[0].State.Name === 'terminated') {
          throw new Error(
            'Instance ' + options.get('id') + ' has already been terminated.'
          );
        }
        return instances[0].PrivateIpAddress;
      })
      .then(function (ip) {
        if (!options.has('dry')) {
          var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          var question = [
            'Are you sure you wish to kill ', options.get('id').cyan,
            '? [y/N]: '
          ].join('');

          return new Promise(function (resolve, reject) {
            rl.question(question, function (answer) {
              rl.close();
              if (answer.charAt(0).toLowerCase() !== 'y') {
                reject(new Error('Aborted dock kill'));
              }
              resolve(ip);
            });
          });
        }
        else {
          return ip;
        }
      })
      .then(function (ip) {
        return mavis.remove(ip);
      })
      .then(function () {
        return aws.terminate(options.get('id'));
      })
      .then(function () {
        return '✓'.green + ' Dock Slaughtered';
      })
      .catch(function (err) {
        if (err.code === 'DryRunOperation') {
          return '✘'.yellow + ' Dock Not Slaughterd (dry)';
        }
        throw err;
      });
  }
};
