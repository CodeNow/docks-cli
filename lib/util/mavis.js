'use strict';

var options = require('./options');
var request = require('request');
var Spinner = require('cli-spinner').Spinner;
var trim = require('trim');

/**
 * Module for connecting to and fetching/mutating data in mavis. This module
 * will use the `env` option (if set) to determine the mavis hostname.
 * @module docks-cli:util:mavis
 */
module.exports = {
  /**
   * Gets a list of docks from mavis.
   * @return {Promise} A promise that resolves with the docks list.
   */
  list: function (mavisHostname) {
    return new Promise(function (resolve, reject) {
      var host;
      if (mavisHostname) {
        host = mavisHostname;
      }
      else if (options.get('env') === 'production') {
        host = 'mavis.runnable.io';
      }
      else {
        host = 'mavis.runnable-beta.com';
      }

      var requestOptions = {
        url: 'http://' + host + '/docks',
        json: true
      };

      var spinner = new Spinner(
        '%s Fetching ' + options.get('env').green +
        ' docks from ' + host.cyan
      );
      spinner.setSpinnerString('|/-\\');
      spinner.start();

      request.get(requestOptions, function (err, data) {
        spinner.stop();
        console.log('');

        if (err) { return reject(err); }

        if (!Array.isArray(data.body)) {
          reject(new Error('Response from server was not an array.'));
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
  }
}
