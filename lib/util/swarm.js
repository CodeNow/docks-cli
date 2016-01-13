'use strict';

var ansible = require('./ansible');
var childProcess = require('child_process');
var hermes = require('runnable-hermes');
var options = require('./options');
var Promise = require('bluebird');
var Spinner = require('cli-spinner').Spinner;
var execAsync = Promise.promisify(childProcess.exec);
var Dockerode = require('dockerode')

const envToSwarmHostMap = {
  'alpha': 'alpha-services',
  'beta': 'beta-services',
  'delta': 'delta-services',
  'gamma': 'gamma-services',
  'production': 'alpha-services'
};

function setupTunnel (hostname, localPort) {
  return childProcess.spawn('ssh', [
    '-NL', [localPort, 'localhost', '2375'].join(':'), hostname
  ]);
}

module.exports = {
  getHost: function () {
    var host = envToSwarmHostMap[options.get('env')];
    return host || envToSwarmHostMap['beta'];
  },
  getAllContainers: function (orgFilter) {
    var hostname = this.getHost();
    var localPort = '2375';

    var connectSpinner = new Spinner(
      '%s :computer:  Connecting to '.emoji + hostname
    );
    connectSpinner.setSpinnerString('|/-\\');
    connectSpinner.start();

    var queueSpinner = new Spinner(
      '%s :pray:  Fetching containers '.emoji + options.get('env').green
    );
    queueSpinner.setSpinnerString('|/-\\');

    var sshTunnel = setupTunnel(hostname, localPort);

    return Promise
      .delay(5000)
      .then(function () {
        return execAsync('export DOCKER_HOST=tcp://localhost:2375')
      })
      .then(function () {
        connectSpinner.stop();
        queueSpinner.start();
        return execAsync('docker ps --format \'{{.Image}}|{{.Ports}}|{{.Label "instanceName"}}|{{.Label "ownerUsername"}}|{{.Label "com.docker.swarm.constraints"}}|{{.Names}}\' | grep registry')
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
              dockIp: ''
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

        if (orgFilter) {
          return containers.filter(function (container) {
            return container.orgId.toString() === orgFilter.toString()
          })
        }
        return containers
      })
      .finally(function() {
        sshTunnel.kill();
      })
  }
}
