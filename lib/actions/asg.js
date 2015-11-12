'use strict';

var aws = require('../util/aws');
var CLIError = require('../errors/cli-error');
var exists = require('101/exists');
var generateHelp = require('../util/generate-help');
var InvalidArgumentError = require('../errors/invalid-argument-error');
var options = require('../util/options');
var printf = require('printf');
var Promise = require('bluebird');
var question = require('../util/question');
var rabbit = require('../util/rabbit');
var readline = require('readline');
var Table = require('cli-table');
var trim = require('trim');

/**
 * Sub-actions for the asg action.
 * @type {object}
 */
const subActions = {
  /**
   * Lists known auto-scaling groups.
   * @return {Promise} Resolves with the list of asgs.
   */
  list: function () {
    var startTime = new Date().getTime();
    return aws.listAutoScalingGroups()
      .then(function (groups) {
        return groups.map(function (group) {
          return {
            name: group.AutoScalingGroupName,
            org: group.Tags.filter(function (tag) {
              return tag.Key === 'org';
            })[0].Value,
            launchConfiguration: group.LaunchConfigurationName,
            min: group.MinSize,
            max: group.MaxSize,
            desired: group.DesiredCapacity,
            cooldown: group.DefaultCooldown,
            created: group.CreatedTime
          }
        });
      })
      .then(function (groups) {
        var table = new Table({
          head: [
            'Name',
            'Org',
            'Launch Configuration',
            'Min',
            'Max',
            'Desired',
            'Cooldown',
            'Created'
          ],
          colWidths: [16, 16, 24, 6, 6, 10, 12, 47]
        });

        groups.forEach(function (group) {
          table.push([
            group.name,
            group.org,
            group.launchConfiguration,
            group.min,
            group.max,
            group.desired,
            group.cooldown,
            group.created
          ]);
        });

        return [
          table.toString(),
          '✓'.green + ' Query complete in ' +
            (((new Date().getTime()) - startTime) / 1000) + 's'.emoji
        ].join('\n\n');
      });
  },

  /**
   * Creates a new auto-scaling group.
   * @return {Promise} Resolves when the job for creating the ASG has been
   *   published.
   */
  create: function () {
    return Promise
      .try(function () {
        if (!options.has('org')) {
          throw new CLIError('The ' + '--org'.cyan + ' argument is required.');
        }
        return aws.listAutoScalingGroups();
      })
      .then(function (groups) {
        var org = options.get('org').toString();
        var orgGroup = groups.find(function (g) {
          var tag = g.Tags.find(function (tag) { return tag.Key === 'org' });
          return tag.Value === org;
        });
        if (exists(orgGroup)) {
          throw new CLIError(
            'An Auto-Scaling Group for org ' +
            options.get('org').toString().cyan + ' already exists.'
          );
        }
        return rabbit.publish('shiva-asg-create', { githubId: org });
      });
  },

  /**
   * Deletes an auto-scaling group.
   * @return {Promise} Resolves when the job for deleting an ASG has been
   *   published.
   */
  'delete': function () {
    return Promise
      .try(function () {
        if (!options.has('org')) {
          throw new CLIError('The ' + '--org'.cyan + ' argument is required.');
        }
        return aws.listAutoScalingGroups();
      })
      .then(function (groups) {
        var org = options.get('org').toString();
        var orgGroup = groups.find(function (g) {
          var tag = g.Tags.find(function (tag) { return tag.Key === 'org' });
          return tag.Value === org;
        });
        if (!exists(orgGroup)) {
          throw new CLIError(
            'Auto-Scaling Group for org ' +
            options.get('org').toString().cyan + ' does not exist.'
          );
        }
        return rabbit.publish('shiva-asg-delete', { githubId: org });
      });
  }
};

/**
 * Action for managing customer auto-scaling group dock clusters.
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
    return generateHelp({
      name: 'asg',
      description: [
        'The `' + 'asg'.yellow + '` action is used to manage AWS Auto-Scaling ',
        'groups for organization build clusters.'
      ].join(' '),
      subActions: {
        'list': {
          description: 'Lists Auto-Scaling groups in the environment'
        },
        'create': {
          description: 'Creates a new Auto-Scaling group for an organization.',
          options: '--org'
        },
        'delete': {
          description: 'Deletes an Auto-Scaling group with the given name',
          options: '--org'
        }
      }
    });
  },

  /**
   * Executes the provision action.
   * @return {Promise} Resolves after the dock provision has been initiated.
   */
  execute: function () {
    return Promise
      .try(function () {
        if (process.argv.length < 4 || process.argv[3].match(/^-/)) {
          return 'list';
        }
        return process.argv[3];
      })
      .then(function (subAction) {
        var handler = subActions[subAction];
        if (!exists(handler)) {
          throw new CLIError('Unknown sub-action: ' + subAction.green);
        }
        return handler();
      });
  },
};
