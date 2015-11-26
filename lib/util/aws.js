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
var params = {
    /**
     * For now we use VPC to differentiate beta-docks and gamma-docks, but future revs of Shiva will hopefully tag docks with "env" -> "<env_name>"
     */
  beta: {
    Filters: [
      { Name: 'tag:role', Values: ['dock'] },
      { Name: 'vpc-id', Values: ['vpc-9e84e1fb'] }
    ]
  },
  gamma: {
    Filters: [
      { Name: 'tag:role', Values: ['dock'] },
      { Name: 'vpc-id', Values: ['vpc-c53464a0'] }
    ]
  },
  production: {
    Filters: [
      { Name: 'tag:role', Values: ['dock'] },
      { Name: 'vpc-id', Values: ['vpc-b22ccfd7'] }
    ]
  },
};

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
    return ansible.all('aws_access_key_id', 'aws_secret_access_key')
      .then(function (config) {
        return new aws.EC2({
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
  }
};
