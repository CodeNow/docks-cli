'use strict';

var ansible = require('./ansible');
var aws = require('aws-sdk');
var InvalidArgumentError = require('../errors/invalid-argument-error');
var isEmpty = require('101/is-empty');
var isString = require('101/is-string');
var options = require('./options');
var Promise = require('bluebird');
var redis = require('./redis');
var Spinner = require('cli-spinner').Spinner;
var trim = require('trim');

/**
 * Default parameters for beta and production queries.
 * @type {object}
 */
const params = {
  // TODO Remove these soon (once beta and alpha are gone)
  // BEGIN REMOVE SECTION
  beta: {
    Filters: [
      { Name: 'tag:role', Values: ['dock'] },
      { Name: 'instance.group-name', Values: ['beta-docks'] }
    ]
  },
  alpha: {
    Filters: [
      { Name: 'tag:role', Values: ['dock'] },
      { Name: 'instance.group-name', Values: ['alpha-dock-sg'] }
    ]
  },
  // END REMOVE SECTION

  production: {
    Filters: [
      { Name: 'tag:role', Values: ['dock'] },
      // NOTE: This will need to be changed to `delta-dock` after the switch
      { Name: 'instance.group-name', Values: ['alpha-dock-sg'] }
    ]
  },

  stage: {
    Filters: [
      { Name: 'tag:role', Values: ['dock'] },
      { Name: 'tag:env', Values: ['staging'] }
    ]
  },

  staging: {
    Filters: [
      { Name: 'tag:role', Values: ['dock'] },
      { Name: 'tag:env', Values: ['staging'] }
    ]
  },

  delta: {
    Filters: [
      { Name: 'tag:role', Values: ['dock'] },
      { Name: 'instance.group-name', Values: ['delta-dock'] }
    ]
  },

  gamma: {
    Filters: [
      { Name: 'tag:role', Values: ['dock'] },
      { Name: 'instance.group-name', Values: ['gamma-dock'] }
    ]
  }
};

/**
 * The EC2 region to use for the query. As of alpha -> delta transition this
 * will always be Oregon (us-west-2).
 * @type {string}
 */
const region = 'us-west-2';

/**
 * AWS SDK Module.
 * @module docks-cli:util:aws
 */
module.exports = {
  /**
   * Gets an aws-sdk EC2 adapter.
   * @return {Promise} Resolves with the ec2 adapter.
   */
  ec2: function () {
    var env = options.get('env');
    var isProduction = env === 'production' ||
      env === 'alpha' ||
      env === 'staging' ||
      env === 'stage';
    return ansible.all('aws_access_key_id', 'aws_secret_access_key')
      .then(function (config) {
        return new aws.EC2({
          accessKeyId: config.aws_access_key_id,
          secretAccessKey: config.aws_secret_access_key,
          // TODO This logic will no longer be needed after alpha -> delta
          region: isProduction ? 'us-west-1' : region
        });
      });
  },

  /**
   * Gets an aws-sdk AutoScaling adapter.
   * @return {Promise} Resolves with the AutoScaling adapter.
   */
  asg: function () {
    return ansible.all('aws_access_key_id', 'aws_secret_access_key')
      .then(function (config) {
        return new aws.AutoScaling({
          accessKeyId: config.aws_access_key_id,
          secretAccessKey: config.aws_secret_access_key,
          region: options.get('env') === 'production' ?
            'us-west-1' :
            'us-west-2'
        });
      });
  },

  /**
   * Lists docks in AWS.
   * @param [id] Optional id to filter by.
   * @return {Promise} Resolves with the results of the aws lookup.
   */
  list: function (id) {
    var spinnerText = '%s :mag:  Fetching '.emoji + options.get('env').green +
      ' docks from AWS';
    if (isString(id) && !isEmpty(id)) {
      spinnerText += ' (' + id.cyan + ')';
    }
    var spinner = new Spinner(spinnerText);
    spinner.setSpinnerString('|/-\\');
    spinner.start();

    return this.ec2()
      .then(function (ec2) {
        var query = params[options.get('env')];
        if (isString(id)) {
          query.Filters.push({
            Name: 'instance-id',
            Values: [ id ]
          });
        }

        return new Promise(function (resolve, reject) {
          ec2.describeInstances(query, function (err, data) {
            spinner.stop();
            console.log('');
            if (err) { return reject(err); }
            var instances = [];
            data.Reservations.forEach(function (res) {
              res.Instances.forEach(function (instance) {
                instances.push(instance);
              });
            });
            resolve(instances);
          });
        });
      });
  },

  /**
   * Gets a list of all AMIs for an environment.
   * @return {Promise} Resolves with the list of AMIs.
   */
  images: function () {
    return this.ec2()
      .then(function (ec2) {
        return new Promise(function (resolve, reject) {
          var spinner = new Spinner(
            '%s :mag:  Fetching '.emoji + options.get('env').green +
            ' AMIs from AWS'
          );
          spinner.setSpinnerString('|/-\\');
          spinner.start();

          var filters = [
            {
              Name: 'is-public',
              Values: ['false']
            }
          ];

          ec2.describeImages({ Filters: filters }, function (err, data) {
            spinner.stop();
            console.log('');
            if (err) { return reject(err); }
            resolve(data.Images);
          })
        });
      });
  },

  /**
   * Terminates a dock instance with the given id.
   * @param {string} id Id of the dock instance to terminate.
   * @return {Promise} Resolves when the dock terminates.
   */
  terminate: function (id) {
    return this.list(id)
      .then(function (instances) {
        if (instances.length !== 1) {
          throw new InvalidArgumentError(
            'Dock with id ' + id.cyan + ' not found'
          );
        }
        return instances[0]
      })
      .then(function (instance) {
        var ip = instance.PrivateIpAddress;
        var org = instance.Tags.find(function (tag) {
          return tag.Key === 'org';
        }).Value;
        return redis.removeDockFromWeave(ip, org);
      })
      .then(this.ec2)
      .then(function (ec2) {
        return new Promise(function (resolve, reject) {
          var query = {
            InstanceIds: [ id ],
            DryRun: options.has('dry')
          };

          var spinnerText = '%s :gun:  Terminating dock instance '.emoji +
            options.get('id').yellow;
          var spinner = new Spinner(spinnerText);
          spinner.setSpinnerString('|/-\\');
          spinner.start();

          ec2.terminateInstances(query, function (err) {
            spinner.stop();
            console.log('');
            if (err) { return reject(err); }
            resolve();
          })
        })
      });
  },

  /**
   * Helpers for Auto-Scaling groups.
   */
  listAutoScalingGroups: function () {
    return this.asg()
      .then(function (asg) {
        return new Promise(function (resolve, reject) {
          var query = {};
          var spinner = new Spinner(
            '%s :mag:  Fetching '.emoji + options.get('env').green +
            ' Auto-Scaling Groups from AWS'
          );
          spinner.setSpinnerString('|/-\\');
          spinner.start();
          asg.describeAutoScalingGroups(query, function (err, data) {
            spinner.stop();
            console.log('');
            if (err) { return reject(err); }
            resolve(data.AutoScalingGroups);
          });
        });
      });
  }
};
