'use strict'

require('./text')
const childProcess = require('child_process')
const fs = require('fs')
const join = require('path').join
const Promise = require('bluebird')
const Spinner = require('cli-spinner').Spinner
const Swarmerode = require('swarmerode')
var Dockerode = require('dockerode')

Dockerode = Swarmerode(Dockerode)
var certPath = process.env.DEVOPS_SCRIPTS_PATH + '/ansible/roles/docker_client/files/certs'

/**
 * Maps environment to swarm host name.
 * @type {object}
 */
const envToRabbitHostMap = {
  'alpha': 'alpha-services',
  'beta': 'beta-services',
  'delta': 'delta-services',
  'gamma': 'gamma-services',
  'epsilon': 'epsilon-services',
  'production': 'alpha-services'
}

/**
 * Module for connecting to and fetching/mutating data in swarm. This module
 * will use the `env` option (if set) to determine the swarm hostname.
 * @module docks-cli:util:swarm
 */
module.exports = {
  /**
   * Gets the swarm host based on the `env` option.
   * @param {string} givenHostname If a hostname was given use it.
   * @return {string} The swarm hostname.
   */
  getHost: function (options) {
    var host = envToRabbitHostMap[options.env]
    return host || envToRabbitHostMap['gamma']
  },
  /**
   * Gets a list of docks from swarm.
   * @return {Promise} A promise that resolves with the docks list.
   */
  list: function (options) {
    var hostname = this.getHost(options)
    var localPort = '56568'
    return Promise.try(function () {
      var connectSpinner = new Spinner(
        '%s :computer:  Connecting to '.emoji + hostname
      )
      connectSpinner.setSpinnerString('|/-\\')
      connectSpinner.start()

      var sshTunnel = childProcess.spawn('ssh', [
        '-NL', [localPort, 'localhost', '2375'].join(':'), hostname
      ])

      return Promise
        .delay(options.dry ? 0 : 5000)
        .then(function () {
          return new Promise(function (resolve, reject) {
            connectSpinner.stop()
            console.log('')

            var docker = Dockerode({
              host: 'localhost',
              port: localPort,
              ca: fs.readFileSync(join(certPath, '/ca.pem')),
              cert: fs.readFileSync(join(certPath, '/swarm-manager/cert.pem')),
              key: fs.readFileSync(join(certPath, '/swarm-manager/key.pem'))
            })

            var spinner = new Spinner(
              '%s :mag:  Fetching '.emoji + options.env.green +
              ' docks from ' + hostname.cyan
            )
            spinner.setSpinnerString('|/-\\')
            spinner.start()

            docker.swarmInfo(function (err, data) {
              spinner.stop()
              console.log('')

              if (err) { return reject(err) }

              // Prepass filter to extract information from composite fields
              var out = []
              Object.keys(data.parsedSystemStatus.ParsedNodes).forEach(function (key) {
                var node = data.parsedSystemStatus.ParsedNodes[key]
                out.push({
                  org: node.Labels.org,
                  ip: node.Host.split(':')[0],
                  containers: node.Containers
                })
              })
              resolve(out)
            })
          })
        })
        .finally(function () {
          sshTunnel.kill()
        })
    })
  }
}
