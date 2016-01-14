'use strict';

var ansible = require('./ansible');
var childProcess = require('child_process');
var hermes = require('runnable-hermes');
var options = require('./options');
var Promise = require('bluebird');
var Spinner = require('cli-spinner').Spinner;
var MongoClient = require('mongodb').MongoClient

const envToSwarmHostMap = {
  'alpha': 'alpha-mongo-a',
  'beta': 'beta-mongo-a',
  'delta': 'delta-mongo-a',
  'gamma': 'gamma-mongo-a',
  'production': 'alpha-mongo-a'
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
      '-NL', '27018:localhost:27017', hostname
    ]);
    return Promise.
      delay(5000)
      .then(function () {
        return tunnel
      })
      .disposer(function (tunnel) {
        tunnel.kill();
      })
  },

  getConnection: function () {
    var hostname = this.getHost();

    var connectSpinner = new Spinner(
      '%s :computer:  Connecting to '.emoji + hostname
    );
    connectSpinner.setSpinnerString('|/-\\');
    connectSpinner.start();


    return Promise.using(this.setupTunnel(hostname), function () {
      return ansible.get('api_mongo_database')
        .then(function (dbName) {
          var url = 'mongodb://localhost:27018/' + dbName;
          return Promise.fromCallback(function (cb) {
              MongoClient.connect(url, cb)
            })
            .disposer(function (connection) {
              connection.close()
            })
        })
    })
  },

  /**
   * Retrieves a list of all containers across all the docks
   * @param {String} orgFilter - Optional filter of the org
   * @returns {Promise[Container]} - Resolves to a list of containers
   */
  getAllContainers: function (orgFilter) {
    var queueSpinner = new Spinner(
      '%s :pray:  Fetching containers '.emoji + options.get('env').green
    );
    queueSpinner.setSpinnerString('|/-\\');

    return Promise.using(this.getConnection(), function (mongoConnection) {
      var instancesCollection = mongoConnection.collection('instances')
      return Promise.fromCallback(function (cb) {
        var search = {
          'container.dockerContainer': {$exists: true}
        }
        if (orgFilter) {
          search['owner.github'] = orgFilter
        }
        instancesCollection.find(search, {'container.dockerContainer': 1, 'owner': 1, 'name': 1}).toArray(cb)
      })
        .then(function (containers) {
          return containers
        })
    })
  }
}
