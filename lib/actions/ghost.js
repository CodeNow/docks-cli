'use strict';

var generateHelp = require('../util/generate-help');
var swarm = require('../util/swarm');
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
    return Promise
      .try(function () {
        return swarm.getAllContainers(options.get('org'));
      })
      .then(function (containers) {
        var imageMap = {}
        containers.forEach(function (container) {
          if (!imageMap[container.image]) {
            var metadata = {
              count: 0,
              ownerUsername: container.ownerUsername,
              orgId: container.orgId,
              instanceName: container.instanceName,
              dockIp: {},
              dockType: {}
            }
            imageMap[container.image] = metadata
          }
          imageMap[container.image].dockIp[container.dockIp] = imageMap[container.image].dockIp[container.dockIp] || 0
          imageMap[container.image].dockIp[container.dockIp]++
          imageMap[container.image].dockType[container.dockType] = imageMap[container.image].dockType[container.dockType] || 0
          imageMap[container.image].dockType[container.dockType]++
          imageMap[container.image].count++
        })


        var table = new Table({
          head: ['ContainerId', 'Count', 'Owner Username', 'Org Id', 'dock ip', 'dock type']
        });

        var total = 0

        var filteredMap = Object.keys(imageMap)
          .filter(function (key) {
            return imageMap[key].count > 1
          })
        filteredMap.forEach(function (key) {
          total += imageMap[key].count

          var dockIp = []
          Object.keys(imageMap[key].dockIp).forEach(function (ip) {
            dockIp.push(ip + ' - ' + imageMap[key].dockIp[ip])
          })

          var dockType = []
          Object.keys(imageMap[key].dockType).forEach(function (ip) {
            dockType.push(ip + ' - ' + imageMap[key].dockType[ip])
          })


          table.push([
            key.replace('registry.runnable.com/' + imageMap[key].orgId + '/', ''),
            imageMap[key].count,
            imageMap[key].ownerUsername,
            imageMap[key].orgId,
            dockIp.join('\n'),
            dockType.join('\n')
          ])
        })
        return [
          table.toString(),
          'Total Ghost Containers: ' + (total - filteredMap.length),
          '✓'.green + ' Query complete in ' +
          (((new Date().getTime()) - startTime) / 1000) + 's'.emoji
        ].join('\n\n')
      })
  }
};
