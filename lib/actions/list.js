'use strict';

var babar = require('babar');
var colors = require('colors');
var dogapi = require('dogapi');
var exists = require('101/exists');
var isFunction = require('101/is-function');
var isNumber = require('101/is-number');
var isString = require('101/is-string');
var options = require('../util/options');
var printf = require('printf');
var Promise = require('bluebird');
var request = require('request');
var Spinner = require('cli-spinner').Spinner;
var Table = require('cli-table');
var trim = require('trim');

/**
 * Datadog API adapter.
 * @type {object}
 */
dogapi.initialize({
 api_key: '6488896fe0c811965ef233b96809d70d',
 app_key: 'c4a05f434e38ccb7d87df1926007498d726fc60c',
});

/**
 * CLI Action Module for Listing Docks.
 * @module docks-cli:actions:list
 */
module.exports = {
  /**
   * Sets the options for the 'list' action.
   */
  options: function () {
    /**
     * Help Argument.
     * @param -h
     * @param --help
     * @default null
     */
    options.set(
      'help',
      'h',
      undefined,
      '',
      'Displays this argument help message.'
    );

    /**
     * Environment Argument.
     * @param -e [name]
     * @param --env [name]
     * @default 'production'
     */
    options.set(
      'env',
      'e',
      'production',
      '[name]=production|beta',
      'The runnable environment to query'
    );

    /**
     * Mavis host argument.
     * @param --host [hostname]
     * @param -h [hostname]
     * @default Host from envrionment flag or finally 'mavis.runnable.io'
     */
    options.set(
      'host',
      'h',
      function () {
        return (options.env === 'beta') ? 'mavis.runnable-beta.com' : 'mavis.runnable.io';
      },
      '[hostname]',
      'Directly sets the mavis hostname'
    );

    /**
     * Organization argument. Limits queries to specific organizations.
     * @param --org [id]
     * @param -o [id]
     * @default `null`
     */
    options.set(
      'org',
      'o',
      undefined,
      '[org]',
      'Filter results by organization id'
    );

    /**
     * Filter by docks that have a number of builds less than a given number.
     * @param --lt [number]
     * @param -l [number]
     * @default `null`
     */
    options.set(
      'lt',
      'l',
      undefined,
      '[number]',
      'Filter by docks with # of builds less than given number'
    );

    /**
     * Filter docks that have a number of builds greater than a given number.
     * @param --gt [number]
     * @param -g [number]
     * @default `null`
     */
    options.set(
      'gt',
      'g',
      undefined,
      '[number]',
      'Filter by docks with # of builds greater than a given number'
    );

    /**
     * Show load per host from datadog along with query (SLOOOWW).
     * @param --load
     * @param -d
     * @default `null`
     */
    // options.set(
    //   'load',
    //   'd',
    //   undefined,
    //   '',
    //   'Fetch and display normalized system load for each host ' + '(slow)'.red.bold
    // );
  },

  /**
   * Help for the 'list' action.
   * @return {Promise} Resolves with the help text for the action.
   */
  help: function () {
    return Promise.try(function () {
      var optionKeys = Object.keys(options.all());
      optionKeys.sort();

      var maxKeyLength = optionKeys.reduce(function (p, c) {
        return (c.length > p) ? c.length : p;
      }, 0);

      var optionHelp = options.allHelp();
      var maxParamsLength = optionKeys.reduce(function (p, c) {
        var len = optionHelp[c].parameters.length;
        return (len > p) ? len : p;
      }, 0);

      var preamble = 'Usage: ' +
        'docks'.magenta +
        ' [options...]'.cyan.italic +
        '\n\nOptions:';

      var optionsList = optionKeys.map(function (key) {
        var help = optionHelp[key];
        return printf('    -%1s', help.short).yellow +
          printf('  --%-' + maxKeyLength + 's', help.long) +
          printf(' %-' + maxParamsLength + 's\n        %s', help.parameters, help.text);
      }).join('\n\n');

      return [preamble, optionsList].join('\n');
    });
  },

  /**
   * Executes the 'list' action.
   * @return {Promise} Resolves with the list of docks.
   */
  execute: function () {
    return new Promise(function (resolve, reject) {
      var requestOptions = {
        url: 'http://' + options.get('host') + '/docks',
        json: true
      };

      var spinner = new Spinner(
        '%s Fetching ' + options.get('env').green +
        ' docks from ' + options.get('host').cyan
      );
      spinner.setSpinnerString('|/-\\');
      spinner.start();

      var startTime = new Date().getTime();
      request.get(requestOptions, function (err, data) {
        spinner.stop();
        if (err) { return reject(err); }
        var docks = data.body;

        if (!Array.isArray(docks)) {
          reject(new Error('Response from server was not an array.'));
        }

        // Prepass filter to extract information from composite fields
        docks = docks.map(function formatDock(dock) {
          var tags = dock.tags.split(',').map(trim);
          return {
            tags: tags,
            org: tags[0],
            host: dock.host,
            ip: dock.host.split('//')[1].split(':')[0],
            builds: parseInt(dock.numBuilds),
            containers: parseInt(dock.numContainers)
          };
        });

        // If they specified an organization, filter by that org id (partial
        // filtering allows to just give the first couple of characters)
        if (options.has('org')) {
          docks = docks.filter(function (dock) {
            return dock.org.match(new RegExp('^' + options.get('org'))) !== null;
          });
        }

        // If they specified a number of builds "less-than" a certain number
        if (options.has('lt')) {
          docks = docks.filter(function (dock) {
            return parseInt(dock.builds) < parseInt(options.get('lt'));
          });
        }

        // If they specified a number of builds "greater-than" a certain number
        if (options.has('gt')) {
          docks = docks.filter(function (dock) {
            return parseInt(dock.builds) > parseInt(options.get('gt'));
          });
        }

        // Sort the result set by organization ascending, and then by host ip asc
        docks.sort(function (a, b) {
          if (a.org === b.org) {
            var octetsA = a.ip.split('.').map(parseInt);
            var octetsB = b.ip.split('.').map(parseInt);
            for (let i = 3; i >= 0; i--) {
              if (octetsA[i] === octetsB[i]) { continue; }
              if (octetsA[i] < octetsB[i]) { return -1; }
              return 1;
            }
            return 0;
          }
          else if (a.org.match('default')) {
            return 1;
          }
          else if (b.org.match('default')) {
            return -1;
          }
          return parseInt(a.org) < parseInt(b.org) ? -1 : 1;
        });

        // Build and resolve with the results table
        var table = new Table({
          head: ['Org', 'IP', 'Builds', 'Full Host'],
          colWidths: [12, 16, 10, 31]
        });

        //babar([[0, 1], [1, 2], [2, 4], [3, 8], [4, 3]], { height: 10, width: 50 })

        var rows = docks.forEach(function (dock) {
          table.push([
            dock.org,
            dock.ip,
            dock.builds,
            dock.host
          ]);
        });

        resolve([
          table.toString(),
          '[Success]'.green + ' Query complete in ' +
            (((new Date().getTime()) - startTime) / 1000) + 's'
        ].join('\n\n'));
      });
    });
  }
};
