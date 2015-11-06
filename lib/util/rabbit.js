'use strict';

var ansible = require('./ansible');
var childProcess = require('child_process');
var colors = require('colors');
var hermes = require('runnable-hermes');
var options = require('./options');
var Promise = require('bluebird');
var Spinner = require('cli-spinner').Spinner;

module.exports = {
  /**
   * Publishes a job into the given queue name.
   * @param {string} queueName Name of the queue.
   * @param {object} job Job to publish.
   * @return {Promise} A promise that resolves when the job has been published.
   */
  publish: function(queueName, job) {
    return ansible.all('rabbit_username', 'rabbit_password')
      .then(function (config) {
        var localPort = '56565';
        var hostname = (options.get('env') === 'production') ?
          'alpha-rabbit' : 'beta-rabbit';

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

        var connectSpinner = new Spinner('%s Connecting to ' + hostname);
        connectSpinner.setSpinnerString('|/-\\');
        connectSpinner.start();

        var queueSpinner = new Spinner(
          '%s Enquing ' + options.get('env').green + ' job into ' +
          '`' + queueName.yellow + '`'
        );
        queueSpinner.setSpinnerString('|/-\\');

        return Promise
          .delay(1000)
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
              return '✘'.yellow + ' Not Published (dry): ' + jobText;
            }
            return '✓'.green + ' Published: ' + jobText;
          })
          .finally(function() {
            sshTunnel.kill();
          })
      });
  }
}
