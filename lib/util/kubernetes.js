'use strict'

const childProcess = require('child_process')
const K8s = require('k8s')
const Promise = require('bluebird')
const kubectl = K8s.kubectl({
  binary: '/usr/local/bin/kubectl'
})

/**
 * Maps environment to Kubernetes context name.
 * @type {object}
 */
// TODO: Use `kubectl config get-contexts` in the future
const envToKubernetesContextMap = {
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
    const contextName = envToKubernetesContextMap[options.env]
    return contextName || envToKubernetesContextMap['gamma']
  },

  /** Change K8s context by Cluster Name
   * @param {String} clustName Context name to switch to
   * @return {Promise} A promise that resolves with the new K8s context.
   */
  changeContext: function (contextName) {
    return Promise.resolve(kubectl.command('config use-context ' + contextName))
  },

  /**
   * Find one K8s Pod Name
   * @param {String} query String to search pod list with
   * @return {Promise} A promise that resolves with the Swarm Manager pod name
   */
  getPodName: function (query) {
    return Promise.resolve(kubectl.pod.list())
      .then((pods) => {
        return pods.items.filter((pod) => (pod.metadata.name.indexOf(query) !== -1))
      })
      .then((pods) => pods[0].metadata.name)
  },

  /**
   * Initiates an SSH Tunnel to a K8s pod
   * @return {Promise} A promise that resolves with the spawned childProcess
   */
  connectToPod: function (podName, localPort) {
    // return execAsync(`kubectl port-forward ${podName} ${localPort}:2375`)
    return new Promise((resolve, reject) => {
      const sshTunnel = childProcess.spawn('kubectl', [
        'port-forward', podName, localPort + ':2375'
      ])
      sshTunnel.stdout.on('data', resolve(sshTunnel))
      sshTunnel.stderr.on('data', (data) => reject(data.toString('utf8')))
    })
  }
}
