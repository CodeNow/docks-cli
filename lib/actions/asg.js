'use strict';

var aws = require('../util/aws');
var CLIError = require('../errors/cli-error');
var exists = require('101/exists');
var find = require('101/find');
var generateHelp = require('../util/generate-help');
var hasKeypaths = require('101/has-keypaths');
var InvalidArgumentError = require('../errors/invalid-argument-error');
var options = require('../util/options');
var printf = require('printf');
var Promise = require('bluebird');
var question = require('../util/question');
var rabbit = require('../util/rabbit');
var readline = require('readline');
var Table = require('cli-table');
var trim = require('trim');

const envToDockEnvMap = {
  'delta': 'production-delta',
  'epsilon': 'production-epsilon',
  'gamma': 'production-gamma',
  'production': 'production-delta',
  'stage': 'staging',
  'staging': 'staging',
};

/**
 * Returns prefix of asg name for current env
 * @return {String} asg prefix
 */
function getDockEnvName () {
  var host = envToDockEnvMap[options.get('env')];
  return host || envToDockEnvMap.gamma;
}

/**
 * Ensures that the user provided the `--org` flag.
 * @throws {CLIError} If the user has not provided the --org flag.
 */
function validateHasOrgFlag() {
  if (!options.has('org')) {
    throw new CLIError('The ' + '--org'.cyan + ' argument is required.');
  }
}

/**
 * Ensures that an auto-scaling group for the given organization does not exist.
 * @throws {CLIError} If the ASG for the org exists.
 * @return {Promise} Resolves with the organization id if the group does not
 *   exist.
 */
function checkOrgDoesNotExist() {
  return aws.listAutoScalingGroups()
    .then(function (groups) {
      var orgToTest = options.get('org').toString();
      var orgGroup = groups.find(function (g) {
        var org = find(g.Tags, hasKeypaths({ 'Key': 'org' }));
        var env = find(g.Tags, hasKeypaths({ 'Key': 'env' }));
        var envToTest = getDockEnvName();
        return org.Value === orgToTest && env.Value === envToTest;
      });
      if (exists(orgGroup)) {
        throw new CLIError(
          'An Auto-Scaling Group for org ' +
          orgToTest.cyan + ' already exists.'
        );
      }
      return orgToTest;
    });
}

/**
 * Determines if an auto-scaling group for the given organization.
 * @throws {CLIError} If the org does not exist.
 * @return {Promise} Resolves with the organization id if the group exists.
 */
function checkOrgExists() {
  return aws.listAutoScalingGroups()
    .then(function (groups) {
      var orgToTest = options.get('org').toString();
      var orgGroup = groups.find(function (g) {
        var org = find(g.Tags, hasKeypaths({ 'Key': 'org' }));
        var env = find(g.Tags, hasKeypaths({ 'Key': 'env' }));
        var envToTest = getDockEnvName();
        return org.Value === orgToTest && env.Value === envToTest;
      });
      if (!exists(orgGroup)) {
        throw new CLIError(
          'An Auto-Scaling Group for org ' +
          orgToTest.cyan + ' does not exist.'
        );
      }
      return orgToTest;
    });
}

/**
 * Check whether the group exists and throw an error if it doesnt
 * @throws {CLIError} If the group does not exist.
 * @return {Object} Return the group object if it exists
 */
function checkGroupExists (group) {
  if (!group) {
    var message = 'The group you\'ve specified does not exist.';
    message += ' Did you remmember to pass an environemnt (`--environment`)?';
    throw new CLIError(message);
  }
  return group;
}

/**
 * Given a raw set of groups from AWS construct an easy to use list. Also limits
 * groups to those for the provided environment.
 * @return {Array} A nicely formatted list of groups for the given environment.
 */
function formatGroups(groups) {
  var env = options.get('env');
  if (env === 'gamma') {
    env = 'production-gamma';
  }
  return groups.map(function (group) {
    return {
      name: group.AutoScalingGroupName,
      org: group.Tags.filter(function (tag) {
        return tag.Key === 'org';
      })[0].Value,
      env: (group.Tags.find(function (tag) {
        return tag.Key === 'env';
      }) || {Value: ''}).Value,
      launchConfiguration: group.LaunchConfigurationName,
      min: group.MinSize,
      max: group.MaxSize,
      desired: group.DesiredCapacity,
      cooldown: group.DefaultCooldown,
      created: group.CreatedTime
    };
  }).filter(function (group) {
    if ([ 'epsilon', 'gamma', 'delta' ].indexOf(env) !== -1) {
      env = 'production-' + env;
    }
    return group.env === env;
  });
}

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
      .then(formatGroups)
      .then(function (groups) {
        var table = new Table({
          head: [
            'Name',
            'Org',
            'Min',
            'Desired',
            'Max',
            'Launch Configuration',
            'Cooldown',
            'Created'
          ],
          colWidths: [32, 12, 6, 10, 6, 34, 12, 41]
        });

        groups.forEach(function (group) {
          table.push([
            group.name,
            group.org,
            group.min,
            group.desired,
            group.max,
            group.launchConfiguration,
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
      .try(validateHasOrgFlag)
      .then(checkOrgDoesNotExist)
      .then(function (org) {
        return rabbit.publish('asg.create', { githubId: org });
      });
  },

  /**
   * Deletes an auto-scaling group.
   * @return {Promise} Resolves when the job for deleting an ASG has been
   *   published.
   */
  'delete': function () {
    return Promise
      .try(validateHasOrgFlag)
      .then(checkOrgExists)
      .then(function (org) {
        return rabbit.publish('asg.delete', { githubId: org });
      });
  },

  /**
   * Sets the number of instances in the auto-scaling group to zero. This
   * effectively turns the ASG off without destroying it completely.
   * @return {Promise} Resolves when the job for completely scaling-in the ASG
   *   has completed.
   */
  off: function () {
    return Promise
      .try(validateHasOrgFlag)
      .then(checkOrgExists)
      .then(function (org) {
        return rabbit.publish('asg.update', {
          githubId: org,
          data: {
            MinSize: 0,
            DesiredCapacity: 0
          }
        });
      });
  },

  /**
   * Changes the launch configuration for a group.
   * @return {Promise} Resolves when the launch configuration has been changed
   *   for the group.
   */
  lc: function () {
    return Promise
      .try(function validateHasLC() {
        if (!options.has('lc')) {
          throw new CLIError('The ' + '--lc'.cyan + ' argument is required.')
        }
      })
      .then(validateHasOrgFlag)
      .then(checkOrgExists)
      .then(function (org) {
        var lcName = options.get('lc');
        return rabbit.publish('asg.update', {
          githubId: org,
          data: {
            LaunchConfigurationName: lcName
          }
        });
      })
  },

  /**
   * Scale-out the group by the given number of instances.
   * @return {Promise} Resolves when the launch configuration has been changed
   *   for the group.
   */
  'scale-out': function () {
    return Promise
      .try(validateHasOrgFlag)
      .then(aws.listAutoScalingGroups.bind(aws))
      .then(formatGroups)
      .then(function (groups) {
        return groups.find(function (group) {
          return group.org === options.get('org').toString();
        })
      })
      .then(checkGroupExists)
      .then(function (group) {
        var org = options.get('org').toString();
        var number = 1;
        var envNumber = options.get('number');
        if (envNumber) {
          number = parseInt(envNumber);
        }
        if (number <= 0) {
          throw new CLIError('Scale out number must be greater than 0');
        }

        var data = {
          MinSize: group.min + number,
          DesiredCapacity: group.desired + number,
          MaxSize: group.max + number
        };

        return rabbit.publish('asg.update', { githubId: org, data: data });
      });
  },

  /**
   * Scale-in the group by the given number of instances.
   * @return {Promise} Resolves when the launch configuration has been changed
   *   for the group.
   */
  'scale-in': function () {
    return Promise
      .try(validateHasOrgFlag)
      .then(aws.listAutoScalingGroups.bind(aws))
      .then(formatGroups)
      .then(function (groups) {
        return groups.find(function (group) {
          return group.org == options.get('org').toString();
        })
      })
      .then(checkGroupExists)
      .then(function (group) {
        var org = options.get('org').toString();
        var number = 1;
        var envNumber = options.get('number');
        if (envNumber) {
          number = parseInt(envNumber);
        }

        if (number <= 0) {
          throw new CLIError('Scale in number must be greater than 0');
        }

        var data = {
          MinSize: group.min - number,
          DesiredCapacity: group.desired - number,
          MaxSize: group.max - number
        };

        if (data.MinSize < 0 || data.DesiredCapacity < 0) {
          throw new CLIError('The group cannot be scaled-in further.');
        }

        return rabbit.publish('asg.update', { githubId: org, data: data });
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
        'Organization to which the auto-scaling group belongs'
      );

      options.set(
        'lc',
        'l',
        undefined,
        '[lc-name]',
        'Name of a launch configuration to set'
      );

      options.set(
        'number',
        'n',
        1,
        '[integer=1]',
        'Number of instances to scale-in or scale-out'
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
        },
        'off': {
          description: 'Scale-in all instances for the group, effectively'
            + ' turning it off.',
          options: '--org'
        },
        'lc': {
          description: 'Change the launch configuration for a group.',
          options: '--org --lc'
        },
        'scale-out': {
          description: 'Add instances to an auto-scaling group',
          options: '--org [--number]'
        },
        'scale-in': {
          description: 'Remove instances from an auto-scaling group',
          options: '--org [--number]'
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
