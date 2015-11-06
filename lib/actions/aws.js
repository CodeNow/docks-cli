'use strict';

var aws = require('../util/aws');
var colors = require('colors');
var generateHelp = require('../util/generate-help');
var mavis = require('../util/mavis');
var options = require('../util/options');
var Promise = require('bluebird');
var Table = require('cli-table');

/**
 * The master help action. Lists all actions with brief descriptions.
 * @module docks-cli:actions
 */
module.exports = {
  /**
   * Handles options for the aws action.
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
         * Organization argument. Limits queries to specific organizations.
         * @param --org [id]
         * @param -o [id]
         * @default `null`
         */
        options.set(
          'org',
          'o',
          undefined,
          '[org]',
          'Filter results by organization id'
        );

        /**
         * Live argument. Limits queries to only docks that are in rotation.
         * @param --live
         * @param -l
         * @default `null`
         */
        options.set(
          'live',
          'l',
          undefined,
          '',
          'Only show docks that are in rotation.'
        );

        /**
         * Dead argument. Limits queries to only docks that are not in rotation.
         * @param --live
         * @param -l
         * @default `null`
         */
        options.set(
          'dead',
          'd',
          undefined,
          '',
          'Only show docks that are not in rotation.'
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
          'production',
          '[name]=production|beta',
          'The runnable environment to query'
        );
      });
  },

  /**
   * Handles the specific help information for the aws action.
   * @return {Promise} A promise that resolves with the help.
   */
  help: function () {
    return generateHelp('help', [
      'The `' + 'aws'.yellow + '` action lists all docks that are running, ',
      'pending, or terminated in AWS EC2. This list may be different than',
      'that of the docks that are currently in rotation (as mavis uses a ',
      'different data model to track them).'
    ].join(' '))
  },

  /**
   * Executes the aws action.
   * @return {Promise} A promise that resolves with the result of the action.
   */
  execute: function () {
    var startTime = new Date().getTime();
    return aws.list(options.get('org'))
      .then(function (instances) {
        var docks = instances.map(function (instance) {
          return {
            id: instance.InstanceId,
            ami: instance.ImageId,
            state: instance.State.Name,
            type: instance.InstanceType,
            launched: instance.LaunchTime,
            ip: instance.PrivateIpAddress,
            org: instance.Tags.find(function (tag) {
              return tag.Key === 'org'
            }).Value
          };
        });

        docks.sort(function (a, b) {
          if (a.org === b.org) {
            var octetsA = a.ip.split('.').map(parseInt);
            var octetsB = b.ip.split('.').map(parseInt);
            for (let i = 3; i >= 0; i--) {
              if (octetsA[i] === octetsB[i]) { continue; }
              if (octetsA[i] < octetsB[i]) { return -1; }
              return 1;
            }
            return 0;
          }
          else if (a.org.match('default')) {
            return 1;
          }
          else if (b.org.match('default')) {
            return -1;
          }
          return parseInt(a.org) < parseInt(b.org) ? -1 : 1;
        });

        return docks;
      })
      .then(function (docks) {
        if (!options.has('dead') && !options.has('live')) {
          return docks;
        }
        return mavis.list()
          .then(function (live) {
            return docks.filter(function (dock) {
              var found = live.find(function (liveDock) {
                return liveDock.ip === dock.ip;
              });
              return (found && options.has('live')) ||
                (!found && options.has('dead'));
            });
          });
      })
      .then(function (docks) {
        if (!options.has('org')) {
          return docks;
        }
        return docks.filter(function (dock) {
          return dock.org.match(new RegExp('^' + options.get('org'))) !== null;
        });
      })
      .then(function (docks) {
        var table = new Table({
          head: ['ID', 'Org', 'IP', 'Type', 'AMI', 'State', 'Launched'],
          colWidths: [14, 12, 16, 14, 16, 16, 50]
        });

        var rows = docks.forEach(function (dock) {
          table.push([
            dock.id,
            dock.org,
            dock.ip,
            dock.type,
            dock.ami,
            dock.state,
            dock.launched
          ]);
        });

        var result = [
          table.toString(),
          '✓'.green + ' Query complete in ' +
            (((new Date().getTime()) - startTime) / 1000) + 's'
        ].join('\n\n');

        if (options.has('live')) {
          result = 'The following docks are ' + 'in rotation:\n'.green + result;
        }

        if (options.has('dead')) {
          result = 'The following docks are ' + 'not in rotation:\n'.red + result;
        }

        return result;
      });
  }
};