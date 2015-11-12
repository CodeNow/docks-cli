'use strict';

var aws = require('../util/aws');
var generateHelp = require('../util/generate-help');
var mavis = require('../util/mavis');
var options = require('../util/options');
var Promise = require('bluebird');
var Table = require('cli-table');

/**
 * AWS Dock Instances listing action.
 * @module docks-cli:actions
 */
module.exports = {
  /**
   * Handles options for the aws action.
   * @return {Promise} A promise that resolves once options have been set.
   */
  options: function () {
    return Promise
      .try(function () {
        options.set(
          'org',
          'o',
          undefined,
          '[org]',
          'Filter results by organization id'
        );

        options.set(
          'live',
          'l',
          undefined,
          '',
          'Only show docks that are in rotation.'
        );

        options.set(
          'dead',
          'd',
          undefined,
          '',
          'Only show docks that are not in rotation.'
        );

        options.set(
          'state',
          's',
          undefined,
          '[instance-state]=running|pending|etc.',
          'Only show instance with the given state'
        );

        options.set(
          'ami',
          'a',
          undefined,
          '',
          'Fetch and display information about AMIs used by instances ' +
            '(slow-ish)'.yellow
        );
      });
  },

  /**
   * Handles the specific help information for the aws action.
   * @return {Promise} A promise that resolves with the help.
   */
  help: function () {
    return generateHelp({
      name: 'aws',
      description: [
        'The `' + 'aws'.yellow + '` action lists all docks that are running, ',
        'pending, or terminated in AWS EC2. This list may be different than',
        'that of the docks that are currently in rotation (as mavis uses a ',
        'different data model to track them).'
      ].join(' ')
    });
  },

  /**
   * Executes the aws action.
   * @return {Promise} A promise that resolves with the result of the action.
   */
  execute: function () {
    var startTime = new Date().getTime();

    return aws.list(options.get('org'))
      .then(function (instances) {
        var docks = instances.map(function (instance) {
          return {
            id: instance.InstanceId,
            ami: instance.ImageId,
            state: instance.State.Name,
            type: instance.InstanceType,
            launched: instance.LaunchTime,
            ip: instance.PrivateIpAddress,
            org: instance.Tags.find(function (tag) {
              return tag.Key === 'org'
            }).Value
          };
        });
        return docks;
      })
      .then(function (docks) {
        if (options.has('ami')) {
          return aws.images()
            .then(function (images) {
              var imageMap = {};
              images.forEach(function (image) { imageMap[image.ImageId] = image; });
              return imageMap;
            })
            .then(function (imageMap) {
              docks.forEach(function (d) {
                var amiObj = imageMap[d.ami];
                d.ami = amiObj ? amiObj.Name : d.ami;
              });
              return docks;
            })
        }
        return docks;
      })
      .then(function (docks) {
        docks.sort(function (a, b) {
          if (a.org === b.org && a.ip && b.ip) {
            var octetsA = a.ip.split('.').map(parseInt);
            var octetsB = b.ip.split('.').map(parseInt);
            for (let i = 3; i >= 0; i--) {
              if (octetsA[i] === octetsB[i]) { continue; }
              if (octetsA[i] < octetsB[i]) { return -1; }
              return 1;
            }
            return 0;
          }
          else if (a.orgg === b.org) {
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
        return docks;
      })
      .then(function (docks) {
        if (!options.has('dead') && !options.has('live')) {
          return docks;
        }
        return mavis.list()
          .then(function (live) {
            return docks.filter(function (dock) {
              var found = live.find(function (liveDock) {
                return liveDock.ip === dock.ip;
              });
              return (found && options.has('live')) ||
                (!found && options.has('dead'));
            });
          });
      })
      .then(function (docks) {
        if (!options.has('org')) {
          return docks;
        }
        return docks.filter(function (dock) {
          return dock.org.match(new RegExp('^' + options.get('org'))) !== null;
        });
      })
      .then(function (docks) {
        if (!options.has('state')) {
          return docks;
        }
        return docks.filter(function (dock) {
          return dock.state.match(new RegExp('^' + options.get('state'))) !== null;
        });
      })
      .then(function (docks) {
        var colWidths = [14, 12, 16, 14, 15, 20, 43];
        if (options.has('ami')) {
          colWidths[4] = 40;
        }

        var table = new Table({
          head: ['ID', 'Org', 'IP', 'Type', 'AMI', 'State', 'Launched'],
          colWidths: colWidths
        });

        var rows = docks.forEach(function (dock) {
          var state = dock.state;
          if (state === 'running') {
            state = ('✓ ' + state).green;
          }
          else if (state === 'terminated' || state === 'stopped') {
            state = ('✘ ' + state).red;
          }
          else {
            state = ('✓ ' + state).yellow;
          }
          table.push([
            dock.id || '',
            dock.org || '',
            dock.ip || '',
            dock.type || '',
            dock.ami || '',
            state || '',
            dock.launched || ''
          ]);
        });

        var result = [
          table.toString(),
          '✓'.green + ' Query complete in ' +
            (((new Date().getTime()) - startTime) / 1000) + 's'
        ].join('\n\n').emoji;

        if (options.has('live')) {
          result = 'The following docks are ' + 'in rotation:\n'.green + result;
        }

        if (options.has('dead')) {
          result = 'The following docks are ' + 'not in rotation:\n'.red + result;
        }

        return result;
      });
  }
};
