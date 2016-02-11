'use strict'

const ansible = require('./ansible')
const childProcess = require('child_process')
const hermes = require('runnable-hermes')
const Promise = require('bluebird')
const Spinner = require('cli-spinner').Spinner

const envToRabbitHostMap = {
  'alpha': 'alpha-rabbit',
  'beta': 'beta-rabbit',
  'delta': 'delta-rabbit',
  'gamma': 'gamma-rabbit',
  'epsilon': 'epsilon-rabbit',
  'production': 'alpha-rabbit',
  'stage': 'delta-staging-data',
  'staging': 'delta-staging-data'
}

/**
 * Provides methods for interacting with VPC rabbit instances. Note that these
 * methods respond to the `dry` option and will not actually publish jobs if
 * that option is set.
 * @module docks-cli:util:rabbit
 */
module.exports = {
  getHost: function (options) {
    var host = envToRabbitHostMap[options.env]
    return host || envToRabbitHostMap['gamma']
  },
  /**
   * Publishes a job into the given queue name.
   * @param {string} queueName Name of the queue.
   * @param {object} job Job to publish.
   * @return {Promise} A promise that resolves when the job has been published.
   */
  publish: function (queueName, job, options) {
    var hostname = this.getHost(options)
    var localPort = '56565'
    return ansible.all('rabbit_username', 'rabbit_password')
      .then(function (config) {
        var client = hermes.hermesSingletonFactory({
          hostname: 'localhost',
          port: localPort,
          username: config.rabbit_username,
          password: config.rabbit_password,
          queues: [queueName]
        })
        client = Promise.promisifyAll(client)

        var sshTunnel = childProcess.spawn('ssh', [
          '-NL', [localPort, 'localhost', '54321'].join(':'), hostname
        ])

        var connectSpinner = new Spinner(
          '%s :computer:  Connecting to '.emoji + hostname
        )
        connectSpinner.setSpinnerString('|/-\\')
        connectSpinner.start()

        var queueSpinner = new Spinner(
          '%s :rabbit2:  Enquing '.emoji + options.env.green + ' job into ' +
          '`' + queueName.yellow + '`'
        )
        queueSpinner.setSpinnerString('|/-\\')

        return Promise
          .delay(options.dry ? 0 : 5000)
          .then(function () {
            if (options.dry) { return }
            return client.connectAsync()
          })
          .then(function () {
            connectSpinner.stop()
            console.log('')
            queueSpinner.start()
            if (options.dry) { return }
            return client.publish(queueName, job)
          })
          .delay(options.dry ? 0 : 5000)
          .then(function () {
            queueSpinner.stop()
            if (options.dry) { return }
            return client.closeAsync()
          })
          .then(function () {
            if (options.dry) {
              console.error('NOT PUBLISHED. DRY RUN'.red)
            }
            var jobText = JSON.stringify(job).magenta
            return '\n✓'.green + ' Published: ' + jobText
          })
          .finally(function () {
            sshTunnel.kill()
          })
      })
  }
}
