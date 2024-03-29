'use strict'

var ansible = require('./ansible')
var childProcess = require('child_process')
var Promise = require('bluebird')
var Spinner = require('cli-spinner').Spinner
var MongoClient = require('mongodb').MongoClient

const envToSwarmHostMap = {
  'delta': 'delta-mongo-a',
  'gamma': 'gamma-mongo-a'
}

module.exports = {
  /**
   * @returns the host based on the environment
   */
  getHost: function (options) {
    var host = envToSwarmHostMap[options.env]
    return host || envToSwarmHostMap['gamma']
  },

  /**
   * Setup the ssh tunnel to swarm
   * @param {String} hostname to connect to
   */
  setupTunnel: function (hostname) {
    var connectSpinner = new Spinner(
      '%s :computer:  Connecting to '.emoji + hostname.blue
    )
    connectSpinner.setSpinnerString('|/-\\')
    connectSpinner.start()

    var tunnel = childProcess.spawn('ssh', [
      '-NL', '27018:localhost:27017', hostname
    ])
    return Promise.delay(5000)
      .then(function () {
        return tunnel
      })
      .disposer(function (tunnel) {
        tunnel.kill()
        connectSpinner.stop()
      })
  },

  getConnection: function (options) {
    options.name = 'api_mongo_database'
    return ansible.get(options)
      .then(function (dbName) {
        var mongoAuthString = ''
        if (process.env.MONGO_AUTH) {
          mongoAuthString = process.env.MONGO_AUTH + '@'
        }
        var url = 'mongodb://' + mongoAuthString + 'localhost:27018/' + dbName
        return Promise.fromCallback(function (cb) {
          MongoClient.connect(url, cb)
        })
          .then(function (mongoConnection) {
            return mongoConnection
          })
          .disposer(function (connection) {
            connection.close()
          })
      })
  },

  /**
   * Retrieves a list of all containers across all the docks
   * @param {String} orgFilter - Optional filter of the org
   * @returns {Promise[Container]} - Resolves to a list of containers
   */
  getAllContainers: function (options) {
    var orgFilter = options.org
    var queueSpinner = new Spinner(
      '%s :pray:  Fetching containers '.emoji + options.env.rainbow
    )
    queueSpinner.setSpinnerString('|/-\\')
    var self = this

    var hostname = self.getHost(options)
    return Promise.using(self.setupTunnel(hostname), function () {
      return Promise.using(self.getConnection(options), function (mongoConnection) {
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
    })
  }
}
