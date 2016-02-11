'use strict'

const childProcess = require('child_process')
const exists = require('101/exists')
const Promise = require('bluebird')
const redis = require('redis')
Promise.promisifyAll(redis.RedisClient.prototype)
Promise.promisifyAll(redis.Multi.prototype)
const Spinner = require('cli-spinner').Spinner

// SSH Tunnel information
const localPort = '52221'
var sshTunnel
var client

/**
 * Methods for getting and modifying redis data via the CLI.
 * @module docks-cli:util:redis
 */
module.exports = {
  /**
   * Creates an SSH tunnel to environment redis and creates a client.
   * @return {Promise} Resolves with a redis client.
   */
  getClient: function (options) {
    if (client) {
      return Promise.resolve(client)
    }
    return this.spawnTunnel(options)
      .then(function () {
        client = redis.createClient({ port: localPort })
        return client
      })
  },

  /**
   * Spawns an SSH tunnel to redis.
   * @return {Promise} Resolves when the SSH tunnel has connected.
   */
  spawnTunnel: function (options) {
    if (exists(sshTunnel)) {
      return Promise.resolve()
    }

    var hostname = 'beta-redis'
    if (options.env === 'production') {
      hostname = 'alpha-redis'
    } else if (options.env === 'gamma') {
      hostname = 'gamma-redis'
    }

    sshTunnel = childProcess.spawn('ssh', [
      '-NL', [localPort, 'localhost', '6379'].join(':'), hostname
    ])

    var connectSpinner = new Spinner(
      '%s :computer:  Connecting to Redis ('.emoji + hostname.green + ')'
    )
    connectSpinner.setSpinnerString('|/-\\')
    connectSpinner.start()
    return Promise.delay(3000)
      .then(function () {
        connectSpinner.stop()
        console.log('')
      })
  },

  /**
   * Kills the SSH tunnel to redis.
   */
  killTunnel: function () {
    if (exists(sshTunnel)) {
      // This is a hack since there is no way to manually disconnect
      client.on('error', function (err) {
        if (err.message.match(/ECONNREFUSED/)) {
          return
        }
        throw err
      })
      sshTunnel.kill()
    }
  },

  /**
   * Method to get the weave member docks for a given organization.
   * @param {string} org Id of the org.
   * @return {Promise} Resolves with the result.
   */
  getWeaveSet: function (options) {
    var org = options.org
    return this.getClient(options)
      .then(function (client) {
        return client.smembersAsync(['weave', 'peers', org].join(':'))
      })
      .finally(this.killTunnel)
  },

  /**
   * Removes a dock from its single tenant weave network.
   * @param {string} ip IP of the dock to remove.
   * @param {string} org Id of the org to which the dock belongs.
   */
  removeDockFromWeave: function (options) {
    var ip = options.ip
    var org = options.org
    var actionSpinner = new Spinner(
      '%s :cocktail:  Removing dock '.emoji + ip + ' from weave network'
    )
    actionSpinner.setSpinnerString('|/-\\')

    return this.getClient()
      .then(function (client) {
        actionSpinner.start()
        if (options.dry) { return Promise.delay(250) }
        return client.sremAsync(['weave', 'peers', org].join(':'), ip)
      })
      .then(function () {
        actionSpinner.stop()
        console.log('')
      })
      .finally(this.killTunnel)
  }
}
