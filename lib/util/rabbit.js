'use strict';

var ansible = require('./ansible');
var childProcess = require('child_process');
var DryRunError = require('../errors/dry-run-error');
var hermes = require('runnable-hermes');
var options = require('./options');
var Promise = require('bluebird');
var Spinner = require('cli-spinner').Spinner;

const envToRabbitHostMap = {
  'alpha': 'alpha-rabbit',
  'beta': 'beta-rabbit',
  'delta': 'delta-rabbit',
  'gamma': 'gamma-rabbit',
  'production': 'alpha-rabbit',
  'stage': 'alpha-stage-data',
  'staging': 'alpha-stage-data',
};

/**
 * Provides methods for interacting with VPC rabbit instances. Note that these
 * methods respond to the `dry` option and will not actually publish jobs if
 * that option is set.
 * @module docks-cli:util:rabbit
 */
module.exports = {
  getHost: function () {
    var host = envToRabbitHostMap[options.get('env')];
    return host || envToRabbitHostMap['beta'];
  },
  /**
   * Publishes a job into the given queue name.
   * @param {string} queueName Name of the queue.
   * @param {object} job Job to publish.
   * @return {Promise} A promise that resolves when the job has been published.
   */
  publish: function(queueName, job) {
    var hostname = this.getHost();
    var localPort = '56565';
    return ansible.all('rabbit_username', 'rabbit_password')
      .then(function (config) {
        var client = hermes.hermesSingletonFactory({
          hostname: 'localhost',
          port: localPort,
          username: config.rabbit_username,
          password: config.rabbit_password,
          queues: [queueName]
        });
        client = Promise.promisifyAll(client);

        var sshTunnel = childProcess.spawn('ssh', [
          '-NL', [localPort, 'localhost', '54321'].join(':'), hostname
        ]);

        var connectSpinner = new Spinner(
          '%s :computer:  Connecting to '.emoji + hostname
        );
        connectSpinner.setSpinnerString('|/-\\');
        connectSpinner.start();

        var queueSpinner = new Spinner(
          '%s :rabbit2:  Enquing '.emoji + options.get('env').green + ' job into ' +
          '`' + queueName.yellow + '`'
        );
        queueSpinner.setSpinnerString('|/-\\');

        return Promise
          .delay(2500)
          .then(function () {
            return client.connectAsync();
          })
          .then(function () {
            connectSpinner.stop();
            console.log('');
            queueSpinner.start();
            if (!options.has('dry')) {
              client.publish(queueName, job);
            }
          })
          .delay(500)
          .then(function () {
            queueSpinner.stop();
            return client.closeAsync();
          })
          .then(function () {
            var jobText = JSON.stringify(job).magenta;
            if (options.has('dry')) {
              throw new DryRunError('Not Published');
            }
            return '\n✓'.green + ' Published: ' + jobText;
          })
          .finally(function() {
            sshTunnel.kill();
          })
      });
  }
}
