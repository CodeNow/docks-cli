'use strict';

var CLIError = require('../errors/cli-error');
var generateHelp = require('../util/generate-help');
var InvalidArgumentError = require('../errors/invalid-argument-error');
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
   * Help for the unhealthy action.
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
   * Executes the provision action.
   * @return {Promise} Resolves after the dock provision has been initiated.
   */
  execute: function () {
    var startTime = new Date().getTime();
    return Promise
      .try(function () {
        return swarm.getAllContainers();
      })
      .then(function (containers) {
        var imageMap = {}
        containers.forEach(function (container) {
          if (!imageMap[container.image]) {
            imageMap[container.image] = 0
          }
          imageMap[container.image]++
        })


        var table = new Table({
          head: ['ContainerId', 'Count'],
          colWidths: [86, 8]
        });

        var ghostContainers = []
        Object.keys(imageMap)
          .filter(function (key) {
            return imageMap[key] > 1
          })
          .forEach(function (key) {
            table.push([
              key,
              imageMap[key]
            ])
          })

        console.log(ghostContainers);

        return [
          table.toString(),
          '✓'.green + ' Query complete in ' +
          (((new Date().getTime()) - startTime) / 1000) + 's'.emoji
        ].join('\n\n')
      })
  }
};
