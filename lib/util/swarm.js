'use strict';

var ansible = require('./ansible');
var childProcess = require('child_process');
var hermes = require('runnable-hermes');
var options = require('./options');
var Promise = require('bluebird');
var Spinner = require('cli-spinner').Spinner;
var execAsync = Promise.promisify(childProcess.exec);

const envToSwarmHostMap = {
  'delta': 'delta-services',
  'gamma': 'gamma-services'
};

module.exports = {
  /**
   * @returns the host based on the environment
   */
  getHost: function () {
    var host = envToSwarmHostMap[options.get('env')];
    return host || envToSwarmHostMap['beta'];
  },

  /**
   * Setup the ssh tunnel to swarm
   * @param {String} hostname to connect to
   */
  setupTunnel: function (hostname) {
    var tunnel = childProcess.spawn('ssh', [
      '-NL', '2375:localhost:2375', hostname
    ]);
    return Promise.
      delay(2000)
      .then(function () {
        return tunnel
      })
      .disposer(function (tunnel) {
        tunnel.kill();
      })
  },

  /**
   * Retrieves a list of all containers across all the docks
   * @param {String} orgFilter - Optional filter of the org
   * @returns {Promise[Container]} - Resolves to a list of containers
   */
  getAllContainers: function (orgFilter) {
    var hostname = this.getHost();

    var connectSpinner = new Spinner(
      '%s :computer:  Connecting to '.emoji + hostname
    );
    connectSpinner.setSpinnerString('|/-\\');
    connectSpinner.start();

    var queueSpinner = new Spinner(
      '%s :pray:  Fetching containers '.emoji + options.get('env').green
    );
    queueSpinner.setSpinnerString('|/-\\');

    return Promise.using(this.setupTunnel(hostname), function () {
      return Promise.resolve()
        .then(function () {
          connectSpinner.stop();
          queueSpinner.start();
          return execAsync('docker ps -H tcp://localhost:2375 --no-trunc=true --format \'{{.Image}}|{{.Ports}}|{{.Label "instanceName"}}|{{.Label "ownerUsername"}}|{{.Label "com.docker.swarm.constraints"}}|{{.Names}}|{{.ID}}|{{.Status}}\' | grep registry')
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
                context: containerParams[0].split('/')[2].split(':')[0],
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
          queueSpinner.stop();

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
  }
}
