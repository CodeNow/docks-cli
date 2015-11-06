'use strict';

var ansible = require('./ansible');
var aws = require('aws-sdk');
var isString = require('101/is-string');
var options = require('./options');
var Promise = require('bluebird');
var Spinner = require('cli-spinner').Spinner;
var trim = require('trim');

/**
 * Default parameters for beta and production queries.
 * @type {object}
 */
var params = {
  beta: {
    Filters: [
      { Name: 'tag:role', Values: ['dock'] },
      { Name: 'key-name', Values: ['oregon'] }
    ]
  },
  production: {
    Filters: [
      { Name: 'tag:role', Values: ['dock'] }
    ]
  }
};

/**
 * AWS SDK Module.
 * @module docks-cli:util:aws
 */
module.exports = {
  /**
   * Lists docks in AWS.
   * @param [org] Optional organization tag to filter by.
   * @return {Promise} Resolves with the results of the aws lookup.
   */
  list: function () {
    var spinner = new Spinner(
      '%s Fetching ' + options.get('env').green + ' docks from AWS'
    );
    spinner.setSpinnerString('|/-\\');
    spinner.start();

    return ansible.all('aws_access_key_id', 'aws_secret_access_key')
      .then(function (config) {
        var ec2 = new aws.EC2({
          accessKeyId: config.aws_access_key_id,
          secretAccessKey: config.aws_secret_access_key,
          region: options.get('env') === 'production' ?
            'us-west-1' :
            'us-west-2'
        });

        return new Promise(function (resolve, reject) {
          var query = params[options.get('env')];
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
  }
};
