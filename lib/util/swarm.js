'use strict'

require('./text')
const childProcess = require('child_process')
const K8s = require('k8s')
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

const kubectl = K8s.kubectl({
  binary: '/usr/local/bin/kubectl'
})

/**
 * Maps environment to Kubernetes cluster name.
 * @type {object}
 */
const envToKubernetesClusterMap = {
  'delta': 'kubernetes.runnable.com',
  'gamma': 'kubernetes.runnable-gamma.com'
}

/**
 * Module for connecting to and fetching/mutating data in swarm. This module
 * will use the `env` option (if set) to determine the swarm hostname.
 * @module docks-cli:util:swarm
 */
module.exports = {
  /**
   * Gets k8s cluster name based on the `env` option.
   * @param {string} givenHostname If a hostname was given use it.
   * @return {string} The k8s cluster name
   */
  getClusterName: function (options) {
    const clusterName = envToKubernetesClusterMap[options.env]
    return clusterName || envToKubernetesClusterMap['gamma']
  },

  /**
   * Get the Swarm Manager K8s Pod
   * @return {Promise} A promise that resolves with the Swarm Manager pod name
   */
  getSwarmManagerPod: function () {
    return kubectl.pod.list()
      .then((pods) => {
        return pods.items.filter((pod) => (pod.metadata.name.indexOf('swarm-manager') !== -1))
      })
      .then((pods) => pods[0].metadata.name)
  },

  /**
   * Initiates an SSH Tunnel to Swarm Manager
   * @return {Promise} A promise that resolves with the spawned childProcess
   */
  connectToSwarmPod: function (podName, localPort) {
    // return execAsync(`kubectl port-forward ${podName} ${localPort}:2375`)
    return new Promise((resolve, reject) => {
      const sshTunnel = childProcess.spawn('kubectl', [
        'port-forward', podName, localPort + ':2375'
      ])
      sshTunnel.stdout.on('data', resolve(sshTunnel))
      sshTunnel.stderr.on('data', (data) => reject(data.toString('utf8')))
    })
  },

  /**
   * Gets a list of docks from swarm.
   * @return {Promise} A promise that resolves with the docks list.
   */
  list: function (options) {
    const clusterName = this.getClusterName(options)
    const localPort = 53260
    return Promise.resolve(localPort).then((localPort) => {
      const connectSpinner = new Spinner(
        '%s :computer:  Connecting to '.emoji + options.env.green + ' on port ' + localPort
      )
      connectSpinner.setSpinnerString('|/-\\')
      connectSpinner.start()

      return Promise
        .try(() => kubectl.command('config use-context ' + clusterName))
        .then(() => this.getSwarmManagerPod())
        .then((pod) => this.connectToSwarmPod(pod, localPort))
        .delay(options.dry ? 0 : 3000)
        .then((sshTunnel) => {
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
              ' docks from ' + clusterName.cyan
            )
            spinner.setSpinnerString('|/-\\')
            spinner.start()

            docker.swarmInfo((err, data) => {
              spinner.stop()
              console.log('')

              if (err) { 
                sshTunnel.kill()
                return reject(err) 
              }

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
              sshTunnel.kill()
              resolve(out)
            })
          })
        })
        .catch((err) => {
          throw new Error(err)
        })
    })
  },

  /**
   * Get all containers from swarm.
   * @return {Promise} A promise that resolves with the containers from Swarm.
   */
  getAllContainers: function (options) {
    const orgFilter = options.org
    const clusterName = this.getClusterName(options)
    const localPort = 53260
    return Promise.resolve(localPort).then((localPort) => {
      const connectSpinner = new Spinner(
        '%s :computer:  Connecting to '.emoji + clusterName + ' on port ' + localPort
      )
      connectSpinner.setSpinnerString('|/-\\')
      connectSpinner.start()

      const queueSpinner = new Spinner(
        '%s :pray:  Fetching containers '.emoji + options.env.green
      )
      queueSpinner.setSpinnerString('|/-\\')

      return Promise        
        .try(() => kubectl.command('config use-context ' + clusterName))
        .then(() => this.getSwarmManagerPod())
        .then((pod) => this.connectToSwarmPod(pod, localPort))
        .delay(3000)
        .then((sshTunnel) => {
          return Promise.resolve()
            .then(function () {
              connectSpinner.stop()
              queueSpinner.start()
              return execAsync('docker -H tcp://localhost:53260 --tlsverify ' +
                '--tlscacert ' + join(certPath, '/ca.pem') + ' ' +
                '--tlscert ' + join(certPath, '/swarm-manager/cert.pem') + ' ' +
                '--tlskey ' + join(certPath, '/swarm-manager/key.pem') + ' ' +
                'ps -a --no-trunc=true --format \'{{.Image}}|{{.Ports}}|{{.Label "instanceName"}}|{{.Label "ownerUsername"}}|{{.Label "com.docker.swarm.constraints"}}|{{.Names}}|{{.ID}}|{{.Status}}|{{.RunningFor}}\' | grep localhost | grep -v seconds | grep -v "About a minute"', {maxBuffer: 1024 * 5000})
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
              sshTunnel.kill()
              return containers
            })
        })
    })
  }
}
