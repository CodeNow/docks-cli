'use strict';

var ansible = require('./ansible');
var childProcess = require('child_process');
var hermes = require('runnable-hermes');
var options = require('./options');
var Promise = require('bluebird');
var Spinner = require('cli-spinner').Spinner;
var execAsync = Promise.promisify(childProcess.exec);

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
  getAllContainers: function () {
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
        return execAsync('docker ps --format "{{.Image}}|{{.Ports}}|{{.Labels}}" | grep registry')
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
            containers.push({
              image: containerParams[0],
              ports: containerParams[1].split(', '),
              tags: containerParams[2].split(',')
            })
          })
        queueSpinner.stop();

        return containers
      })
      .finally(function() {
        sshTunnel.kill();
      })
  }
}
