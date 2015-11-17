'use strict';

var generateHelp = require('../util/generate-help');
var mavis = require('../util/mavis');
var github = require('../util/github');
var options = require('../util/options');
var Promise = require('bluebird');
var Table = require('cli-table');

/**
 * CLI Action Module for Listing Docks.
 * @module docks-cli:actions:list
 */
module.exports = {
  /**
   * Sets the options for the 'list' action.
   */
  options: function () {
    return Promise
      .try(function () {
        options.set(
          'host',
          'h',
          function () {
            return (options.get('env') === 'beta') ?
              'mavis.runnable-beta.com' :
              'mavis.runnable.io';
          },
          '[hostname]',
          'Directly sets the mavis hostname'
        );

        options.set(
          'org',
          'o',
          undefined,
          '[org]',
          'Filter results by organization id'
        );

        options.set(
          'lt',
          'l',
          undefined,
          '[number]',
          'Filter by docks with # of builds less than given number'
        );

        options.set(
          'gt',
          'g',
          undefined,
          '[number]',
          'Filter by docks with # of builds greater than a given number'
        );

        options.set(
          'github',
          'b',
          undefined,
          '[boolean]',
          'Flag to fetch GitHub org name'
        );
      });
  },

  /**
   * Help for the 'list' action.
   * @return {Promise} Resolves with the help text for the action.
   */
  help: function () {
    return generateHelp('list', [
      'The `' + 'list'.yellow + '` action lists docks that are currently ',
      'in-rotation (handling user requests) in the Runnable infrastructure.',
      'The list can be filtered and pruned via the options detailed below ',
      '(by org, by number of builds, etc.).'
    ].join(' '));
  },

  /**
   * Executes the 'list' action.
   * @return {Promise} Resolves with the list of docks.
   */
  execute: function () {
    var startTime = new Date().getTime();
    return mavis.list(options.get('host'))
      .then(function (docks) {
        // If they specified an organization, filter by that org id (partial
        // filtering allows to just give the first couple of characters)
        if (options.has('org')) {
          docks = docks.filter(function (dock) {
            return dock.org.match(new RegExp('^' + options.get('org'))) !== null;
          });
        }

        // If they specified a number of builds "less-than" a certain number
        if (options.has('lt')) {
          docks = docks.filter(function (dock) {
            return parseInt(dock.builds) < parseInt(options.get('lt'));
          });
        }

        // If they specified a number of builds "greater-than" a certain number
        if (options.has('gt')) {
          docks = docks.filter(function (dock) {
            return parseInt(dock.builds) > parseInt(options.get('gt'));
          });
        }

        // Sort the result set by organization ascending, and then by host ip asc
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
        if (!options.has('github')) {
          return docks;
        }
        return Promise.map(docks, function (dock) {
          var githubName = github.idToName(dock.org);
          return githubName.then(function (name) {
            dock.github = name || '';
            return dock;
          });
        });
      })
      .then(function renderTables (docks) {
        // Build and resolve with the results table
        if (!options.has('github')) {
          var table = new Table({
            head: ['Org', 'IP', 'Builds', 'Full Host'],
            colWidths: [12, 16, 10, 31]
          });
        } else {
          var table = new Table({
            head: ['Org', 'GitHub', 'IP', 'Builds', 'Full Host'],
            colWidths: [12, 16, 16, 10, 31]
          });
        }

        docks.forEach(function (dock) {
          var data = [
            dock.org,
            // where dock.github would go
            dock.ip,
            dock.builds,
            dock.host,
          ]
          if (options.has('github')) {
            data.splice(1, 0, dock.github)
          }
          table.push(data)
        });

        return [
          table.toString(),
          '✓'.green + ' Query complete in ' +
            (((new Date().getTime()) - startTime) / 1000) + 's'.emoji
        ].join('\n\n')
      });
  }
};
