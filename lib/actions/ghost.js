'use strict';

var generateHelp = require('../util/generate-help');
var swarm = require('../util/swarm');
var mongo = require('../util/mongo');
var options = require('../util/options');
var Promise = require('bluebird');
var rabbit = require('../util/rabbit');
var readline = require('readline');
var Table = require('cli-table');

module.exports = {
  /**
   * Sets options for the ghost action.
   * @return {Promise} Resolves after the options have been set.
   */
  options: function () {
    options.set(
      'org',
      'o',
      undefined,
      '[org]',
      'Filter results by organization id'
    );
  },

  /**
   * Help for the ghost action.
   * @return {Promise} Resolves with the help for this action.
   */
  help: function () {
    return generateHelp({
      name: 'ghost',
      description: [
        'The `' + 'ghost'.yellow + '` action returns a list of containers that have duplicates'
      ].join(' ')
    });
  },

  /**
   * Executes the ghost action.
   * @return {Promise} Resolves after the ghost information has been fetched.
   */
  execute: function () {
    var startTime = new Date().getTime();

    var rawContainerCounts = {}
    return swarm.getAllContainers(options.get('org'))
      .then(function (swarmContainers) {
        return mongo.getAllContainers(options.get('org'))
          .then(function (mongoContainers) {
            return {
              swarmContainers: swarmContainers,
              mongoContainers: mongoContainers
            }
          })
      })
      .then(function (params) {
        var swarmContainers = params.swarmContainers;
        var mongoContainers = params.mongoContainers;

        var totalDefault = 0
        var ghostContainers = swarmContainers.filter(function (container) {
          rawContainerCounts[container.ownerUsername] = rawContainerCounts[container.ownerUsername] || 0
          rawContainerCounts[container.ownerUsername]++

          if (container.dockType === 'default') {
            totalDefault++
          }

          return !mongoContainers.find(function (mongoContainer) {
            return mongoContainer.container.dockerContainer === container.id
          })
        })

        var table = new Table({
          head: ['ContainerId', 'instanceName', 'Owner Username', 'dock ip', 'Org Id', 'dock type', 'status']
        });

        var orgGhostContainers = {}
        ghostContainers
          .sort(function (a, b) {
            if (a.ownerUsername < b.ownerUsername)
              return -1;
            else if (a.ownerUsername > b.ownerUsername)
              return 1;
            else
              return 0;
          })
          .forEach(function (container) {
            orgGhostContainers[container.ownerUsername] = orgGhostContainers[container.ownerUsername] || 0
            orgGhostContainers[container.ownerUsername]++
            table.push([
              container.id,
              container.instanceName,
              container.ownerUsername,
              container.dockIp,
              container.orgId,
              container.dockType,
              container.status
            ])
          })

        var orgDetailsTable = new Table({
          head: ['Owner Username', 'Total Containers', 'Ghost Containers', 'Real Containers', 'Percent Ghost Containers']
        })
        Object.keys(rawContainerCounts).forEach(function (key) {
          orgGhostContainers[key] = orgGhostContainers[key] || 0
          orgDetailsTable.push([
            key,
            rawContainerCounts[key],
            orgGhostContainers[key],
            rawContainerCounts[key] - orgGhostContainers[key],
            ((orgGhostContainers[key] / rawContainerCounts[key]) * 100).toFixed(2) + '%'
          ])
        })

        function getPercent(number) {
          return ((number / swarmContainers.length) * 100).toFixed(2) + '%'
        }
        var statsTable = new Table({
          head: ['Type', 'Count', 'Percent']
        })
        statsTable.push([
          'All', swarmContainers.length, getPercent(swarmContainers.length)
        ])
        statsTable.push([
          'Ghost', ghostContainers.length, getPercent(ghostContainers.length)
        ])
        statsTable.push([
          'Real', (swarmContainers.length - ghostContainers.length), getPercent((swarmContainers.length - ghostContainers.length))
        ])
        statsTable.push([
          'On Default', totalDefault, getPercent(totalDefault)
        ])
        return [
          table.toString(),
          orgDetailsTable.toString(),
          statsTable.toString(),
          '✓'.green + ' Query complete in ' +
          (((new Date().getTime()) - startTime) / 1000) + 's'.emoji
        ].join('\n\n')
      })
  }
};
