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

    return Promise.all([
      swarm.getAllContainers(options.get('org')),
      mongo.getAllContainers(options.get('org')),
    ])
      .then(function (params) {
        var swarmContainers = params[0];
        var mongoContainers = params[1]

        var ghostContainers = swarmContainers.filter(function (container) {
          return !mongoContainers.find(function (mongoContainer) {
            return mongoContainer.container.dockerContainer === container.id
          })
        })

        var table = new Table({
          head: ['ContainerId', 'Owner Username', 'dock ip', 'Org Id', 'dock type']
        });

        ghostContainers.forEach(function (container) {
          table.push([
            container.id,
            container.ownerUsername,
            container.dockIp,
            container.orgId,
            container.dockType
          ])
        })
        return [
          table.toString(),
          'Total Ghost Containers: ' + ghostContainers.length,
          '✓'.green + ' Query complete in ' +
          (((new Date().getTime()) - startTime) / 1000) + 's'.emoji
        ].join('\n\n')
      })
  }
};
