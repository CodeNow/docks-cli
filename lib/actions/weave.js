'use strict';

var mavis = require('../util/mavis');
var options = require('../util/options');
var Promise = require('bluebird');
var redis = require('../util/redis');
var Table = require('cli-table');

/**
 * Shows the weave network for an organization's cluster.
 * @module docks-cli:actions
 */
module.exports = {
  options: function () {
    options.set(
      'org',
      'o',
      undefined,
      '[org]',
      'Filter results by organization id'
    );

    options.set(
      'dry',
      'd',
      undefined,
      '',
      'Perform a dry run of the provision (job is not enqueued)'
    );
  },

  help: function () {
    return generateHelp('weave', [
      'The `' + 'weave'.yellow + '` action lists the dock weave network for an',
      'organization with the given id.'
    ].join(' '))
  },

  execute: function () {
    var startTime = new Date().getTime();
    return Promise
      .try(function () {
        if (!options.has('org')) {
          throw new InvalidArgumentError(
            'The ' + '--org'.cyan + ' argument is required.'
          );
        }
        return mavis.list();
      })
      .then(function (docks) {
        return redis.getWeaveSet(options.get('org'))
          .then(function (set) {
            var filterList = set.toString().split(',');
            return docks.filter(function (d) {
              return ~filterList.indexOf(d.ip);
            });
          });
      })
      .then(function (docks) {
        // Build and resolve with the results table
        var table = new Table({
          head: ['Org', 'IP', 'Builds', 'Full Host'],
          colWidths: [12, 16, 10, 31]
        });

        var rows = docks.forEach(function (dock) {
          table.push([
            dock.org,
            dock.ip,
            dock.builds,
            dock.host
          ]);
        });

        return [
          table.toString(),
          '✓'.green + ' Query complete in ' +
            (((new Date().getTime()) - startTime) / 1000) + 's'.emoji
        ].join('\n\n')
      });
  }
};
