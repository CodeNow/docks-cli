'use strict'

require('./text')
const childProcess = require('child_process')
const fs = require('fs')
const join = require('path').join
const Promise = require('bluebird')
const Spinner = require('cli-spinner').Spinner
const Swarmerode = require('swarmerode')
let Dockerode = require('dockerode')

const execAsync = Promise.promisify(childProcess.exec)
Dockerode = Swarmerode(Dockerode)
const certPath = process.env.DEVOPS_SCRIPTS_PATH +
  '/ansible/roles/docker_client/files/certs'

/**
 * Maps environment to swarm host name.
 * @type {object}
 */
const envToSwarmManagerHostMap = {
  'delta': 'delta-swarm-manager',
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
  },

  /**
   * Get all containers from swarm.
   * @return {Promise} A promise that resolves with the docks list.
   */
  getAllContainers: function (options) {
    const orgFilter = options.org
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

      const queueSpinner = new Spinner(
        '%s :pray:  Fetching containers '.emoji + options.env.green
      )
      queueSpinner.setSpinnerString('|/-\\')

      return Promise
        .delay(options.dry ? 0 : 5000)
        .then(() => {
          return Promise.resolve()
            .then(function () {
              connectSpinner.stop()
              queueSpinner.start()
              return execAsync('docker -H tcp://localhost:53260 --tlsverify ' +
                '--tlscacert ' + join(certPath, '/ca.pem') + ' ' +
                '--tlscert ' + join(certPath, '/swarm-manager/cert.pem') + ' ' +
                '--tlskey ' + join(certPath, '/swarm-manager/key.pem') + ' ' +
                'ps -a --no-trunc=true --format \'{{.Image}}|{{.Ports}}|{{.Label "instanceName"}}|{{.Label "ownerUsername"}}|{{.Label "com.docker.swarm.constraints"}}|{{.Names}}|{{.ID}}|{{.Status}}|{{.RunningFor}}\' | grep localhost | grep -v seconds | grep -v "About a minute"', {maxBuffer: 1024 * 500})
            })
            .then(function (results) {
              var containerStrings = results.split('\n')
              var containers = []
              containerStrings
                .filter(function (containerString) {
                  return !!containerString
                })
                .forEach(function (containerString) {
                  var containerParams = containerString.split('|')

                  var container = {
                    image: containerParams[0],
                    ports: containerParams[1].split(', '),
                    instanceName: containerParams[2],
                    ownerUsername: containerParams[3],
                    dockType: '',
                    dockIp: '',
                    id: containerParams[6],
                    context: '',
                    contextVersion: containerParams[0].split(':')[1],
                    status: containerParams[7]
                  }
                  container.orgId = container.image.split('/')[1]

                  var swarmConstraints = containerParams[4].replace(/\"/g, '').replace(']', '').replace('[', '').split(',')
                  swarmConstraints.forEach(function (constraint) {
                    var constraintParts = constraint.split('=')
                    if (constraintParts[0] === 'org') {
                      container.dockType = constraintParts[2]
                    }
                  })
                  container.dockIp = containerParams[5].split('/')[0].replace('ip-', '').replace(/\-/g, '.')
                  containers.push(container)
                })
              queueSpinner.stop()

              containers = containers.filter(function (container) {
                return container.orgId !== 'runnable'
              })
              if (orgFilter) {
                return containers.filter(function (container) {
                  return container.orgId.toString() === orgFilter.toString()
                })
              }
              return containers
            })
        })
        .finally(() => {
          sshTunnel.kill()
        })
    })
  }
}
