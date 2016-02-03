'use strict';

var options = require('./options');
var request = require('request');
var Spinner = require('cli-spinner').Spinner;
var trim = require('trim');

// TODO This whole thing is going to have to go away soon with the advent of
//      swarm.

/**
 * Maps environment to mavis host name.
 * @type {object}
 */
const envToMavisHostMap = {
  'gamma': 'mavis.runnable-gamma.com',
  'epsilon': 'mavis.runnable-beta.com',
  'beta': 'mavis.runnable-beta.com',
  'alpha': 'mavis.runnable.io',
  'production': 'mavis.runnable.io',
  'delta': 'mavis.runnable.io',
  'stage': 'mavis-staging-codenow.runnableapp.com',
  'staging': 'mavis-staging-codenow.runnableapp.com',
};

/**
 * Module for connecting to and fetching/mutating data in mavis. This module
 * will use the `env` option (if set) to determine the mavis hostname.
 * @module docks-cli:util:mavis
 */
module.exports = {
  /**
   * Gets the mavis host based on the `env` option.
   * @param {string} givenHostname If a hostname was given use it.
   * @return {string} The mavis hostname.
   */
  getHost: function () {
    return envToMavisHostMap[options.get('env')] || envToMavisHostMap.gamma;
  },

  /**
   * Gets a list of docks from mavis.
   * @return {Promise} A promise that resolves with the docks list.
   */
  list: function () {
    var host = this.getHost();
    return new Promise(function (resolve, reject) {
      var requestOptions = {
        url: 'http://' + host + '/docks',
        json: true
      };

      var spinner = new Spinner(
        '%s :mag:  Fetching '.emoji + options.get('env').green +
        ' docks from ' + host.cyan
      );
      spinner.setSpinnerString('|/-\\');
      spinner.start();

      request.get(requestOptions, function (err, data) {
        spinner.stop();
        console.log('');

        if (err) { return reject(err); }

        if (!Array.isArray(data.body)) {
          return reject(new Error('Response from server was not an array.'));
        }

        // Prepass filter to extract information from composite fields
        resolve(data.body.map(function formatDock(dock) {
          var tags = dock.tags.split(',').map(trim);
          return {
            tags: tags,
            org: tags[0],
            host: dock.host,
            ip: dock.host.split('//')[1].split(':')[0],
            builds: parseInt(dock.numBuilds),
            containers: parseInt(dock.numContainers)
          };
        }));
      });
    });
  },

  /**
   * Removes a dock with the given ip from rotation.
   * @param {string} ip Ip of the dock to remove.
   * @return {Promise} Resolves when the dock has been removed from rotation.
   */
  remove: function (ip) {
    var host = this.getHost();
    return new Promise(function (resolve, reject) {
      // curl -X DELETE mavis.runnable-beta.com/docks?host=
      var removeHost = 'http://' + ip + ':4242';
      var requestOptions = {
        url: 'http://' + host + '/docks?host=' + removeHost,
        json: true
      };

      var spinner = new Spinner(
        '%s :recycle:  Removing '.emoji + options.get('env').green +
        ' dock ' + ip.yellow + ' from rotation via ' + host.cyan
      );
      spinner.setSpinnerString('|/-\\');
      spinner.start();

      if (options.has('dry')) {
        return setTimeout(function () {
          spinner.stop();
          console.log('');
          resolve();
        }, 1000);
      }

      request.del(requestOptions, function (err, data) {
        spinner.stop();
        console.log('');
        if (err) { return reject(err); }
        resolve(data);
      });
    });
  }
}
