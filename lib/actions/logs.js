'use strict';

var colors = require('colors');
var spawn = require('child_process').spawn;
var generateHelp = require('../util/generate-help');
var isString = require('101/is-string');
var options = require('../util/options');
var printf = require('printf');
var Promise = require('bluebird');

/**
 * Maps service names to log file paths.
 * @type {object}
 */
var servicePaths = {
  'charon': '/var/log/charon.log',
  'dock-init': '/var/log/dock-init.log',
  'docker-listener': '/var/log/docker-listener.log',
  'docker': '/var/log/upstart/docker.log',
  'filibuster': '/var/log/filibuster.log',
  'krain': '/var/log/krain.log',
  'sauron': '/var/log/sauron.log'
};

/**
 * Fetches and displays various dock service logs.
 * @module docks-cli:actions
 */
module.exports = {
  /**
   * Handles options for the logs action.
   * @return {Promise} A promise that resolves once options have been set.
   */
  options: function () {
    return Promise
      .try(function () {
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
          'beta',
          '[name]=production|beta',
          'The runnable environment to query'
        );

        /**
         * Dock host argument.
         * @param --ip [hostip]
         * @param -i [hostip]
         */
        options.set(
          'ip',
          'i',
          undefined,
          '[ipaddress]',
          'The IP for the dock to mark as unhealthy'
        );

        /**
         * The service argument.
         * @param --service
         * @param -s
         * @default 'dock-init'
         */
        options.set(
          'service',
          's',
          'dock-init',
          '[name]',
          'Name of the service: charon, dock-init, docker-listener, ' +
          'docker, filibuster, krain, or sauron'
        );

        /**
         * Path argument.
         * @param --path
         * @param p
         * @default `null`
         */
        options.set(
          'path',
          'p',
          undefined,
          '[log-path]',
          'Custom path to a log on the system'
        );

        /**
         * Follow argument.
         * @param --follow
         * @param f
         * @default `null`
         */
        options.set(
          'follow',
          'f',
          undefined,
          '',
          'When set this will follow the log'
        );
      });
  },

  /**
   * Handles the specific help information for the logs action.
   * @return {Promise} A promise that resolves with the help.
   */
  help: function () {
    return generateHelp('help', [
      'The `' + 'logs'.yellow + '` action is used to get various dock service ',
      'logs and output them to the local terminal. Use the ', '--service'.cyan,
      'option for easy access without having to know the exact log path.'
    ].join(' '))
  },

  /**
   * Executes the logs action.
   * @return {Promise} A promise that resolves with the result of the action.
   */
  execute: function () {
    return Promise
      .try(function () {
        if (!isString(options.get('ip'))) {
          throw new Error(
            'A dock IP must be specified with ' + '--ip'.cyan
          );
        }
      })
      .then(function () {
        var path = servicePaths[options.get('service')] || options.get('path');
        if (!path) {
          throw new Error(
            'Must specify either a valid ' + '--service'.cyan + ' or a valid ' +
            '--path'.cyan
          );
        }
        return path;
      })
      .then(function (path) {
        return new Promise(function (resolve, reject) {
          var cmd = 'sudo tail ';
          if (options.has('follow')) {
            cmd += ' -F ';
          }
          cmd += path;

          var args = [options.get('ip'), cmd ];
          var child = spawn('ssh', args);
          child.stdout.on('data', function (data) {
            console.log(data.toString());
          });
          child.stderr.on('data', function (data) {
            console.log(data.toString());
          });
          child.on('close', function (code) {
            resolve('child process exited with code ' + code);
          });
        });
      });
  }
};
