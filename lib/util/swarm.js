'use strict'

require('./text')
const childProcess = require('child_process')
const fs = require('fs')
const join = require('path').join
const Promise = require('bluebird')
const Spinner = require('cli-spinner').Spinner
const Swarmerode = require('swarmerode')
let Dockerode = require('dockerode')

Dockerode = Swarmerode(Dockerode)
const certPath = process.env.DEVOPS_SCRIPTS_PATH +
  '/ansible/roles/docker_client/files/certs'

/**
 * Maps environment to swarm host name.
 * @type {object}
 */
const envToSwarmManagerHostMap = {
  'delta': 'delta-dock-services',
  'gamma': 'gamma-dock-services',
  'epsilon': 'epsilon-dock-services',
  'production': 'delta-dock-services'
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
    const host = envToSwarmManagerHostMap[options.env]
    return host || envToSwarmManagerHostMap['gamma']
  },
  /**
   * Gets a list of docks from swarm.
   * @return {Promise} A promise that resolves with the docks list.
   */
  list: function (options) {
    const hostname = this.getHost(options)
    const localPort = 53260
    return Promise.resolve(localPort).then((localPort) => {
      const connectSpinner = new Spinner(
        '%s :computer:  Connecting to '.emoji + hostname + ' on port ' + localPort
      )
      connectSpinner.setSpinnerString('|/-\\')
      connectSpinner.start()

      const sshTunnel = childProcess.spawn('ssh', [
        '-NL', [localPort, 'localhost', '2375'].join(':'), hostname
      ])

      return Promise
        .delay(options.dry ? 0 : 5000)
        .then(() => {
          return new Promise((resolve, reject) => {
            connectSpinner.stop()
            console.log('')

            const docker = Dockerode({
              host: 'localhost',
              port: localPort,
              ca: fs.readFileSync(join(certPath, '/ca.pem')),
              cert: fs.readFileSync(join(certPath, '/swarm-manager/cert.pem')),
              key: fs.readFileSync(join(certPath, '/swarm-manager/key.pem'))
            })

            const spinner = new Spinner(
              '%s :mag:  Fetching '.emoji + options.env.green +
              ' docks from ' + hostname.cyan
            )
            spinner.setSpinnerString('|/-\\')
            spinner.start()

            docker.swarmInfo((err, data) => {
              spinner.stop()
              console.log('')

              if (err) { return reject(err) }

              // Prepass filter to extract information from composite fields
              const out = []
              Object.keys(data.parsedSystemStatus.ParsedNodes).forEach((key) => {
                const node = data.parsedSystemStatus.ParsedNodes[key]
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
        .finally(() => {
          sshTunnel.kill()
        })
    })
  }
}
