'use strict';

var ansible = require('../util/ansible');
var childProcess = require('child_process');
var colors = require('colors');
var generateHelp = require('../util/generate-help');
var hermes = require('runnable-hermes');
var options = require('../util/options');
var Promise = require('bluebird');
var readline = require('readline');
var Spinner = require('cli-spinner').Spinner;

/**
 * Action for provisioning new customer docks.
 * @module docks-cli:actions:provision
 */
module.exports = {
  /**
   * Sets options for the provision action.
   * @return {Promise} Resolves after the options have been set.
   */
  options: function () {
    return Promise.try(function () {
      /**
       * Provides help for the provision action.
       * @param -h
       * @param --help
       * @default `null`
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
        'The runnable EC2 environment into which the dock will be provisioned.'
      );

      /**
       * Organization for which to provision the dock.
       * @param --org [id]
       * @param -o [id]
       * @default `null`
       */
      options.set(
        'org',
        'o',
        undefined,
        '[org-id]',
        'Organization for which to provision the dock.'
      );

      /**
       * Dry run option.
       * @param --dry
       * @param -d
       * @default `null`
       */
      options.set(
        'dry',
        'd',
        undefined,
        '',
        'Perform a dry run of the provision (job is not enqueued)'
      )
    });
  },

  /**
   * Help for the provision action.
   * @return {Promise} Resolves with the help for this action.
   */
  help: function () {
    return generateHelp('provision', [
      'The `' + 'provision'.yellow + '` action provisions a new EC2 dock',
      'instance for an organization. Note that this is a convience method',
      'that only enqueues the provisioning job and then exits. It can take up',
      'to ten minutes for the dock to appear in the `' + 'list'.yellow + '`',
      'with the correct organization id.'
    ].join(' '))
  },

  /**
   * Executes the provision action.
   * @return {Promise} Resolves after the dock provision has been initiated.
   */
  execute: function () {
    return Promise
      .try(function () {
        if (!ansible.hasDevopsScriptsPath()) {
          throw new Error('Could not find environment `DEVOPS_SCRIPTS_PATH`');
        }
        if (!options.has('org')) {
          throw new Error('You must specify an org id with ' + '--org'.cyan);
        }
      })
      .then(function () {
        if (!options.has('dry')) {
          var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          var question = [
            'Are you sure you wish to provision a new dock for org ',
            options.get('org').toString().cyan, '? [y/N]: '
          ].join('');

          return new Promise(function (resolve, reject) {
            rl.question(question, function (answer) {
              rl.close();
              if (answer.charAt(0).toLowerCase() !== 'y') {
                reject(new Error('Aborted instance provisioning'));
              }
              resolve();
            });
          });
        }
      })
      .then(function () {
        return ansible.all('rabbit_username', 'rabbit_password');
      })
      .then(function (config) {
        var org = options.get('org').toString();
        var queueName = 'cluster-instance-provision';

        var localPort = '56565';
        var hostname = (options.get('env') === 'production') ?
          'alpha-rabbit' : 'beta-rabbit';

        var client = hermes.hermesSingletonFactory({
          hostname: 'localhost',
          port: localPort,
          username: config.rabbit_username,
          password: config.rabbit_password,
          queues: [queueName]
        });
        client = Promise.promisifyAll(client);

        var sshTunnel = childProcess.spawn('ssh', [
          '-NL', [localPort, 'localhost', '54321'].join(':'), hostname
        ]);

        var queueSpinner = new Spinner(
          '%s Enquing ' + options.get('env').green +
          ' `' + 'cluster-instance-provision'.yellow + '` job for org ' +
          org.cyan
        );
        queueSpinner.setSpinnerString('|/-\\');

        var connectSpinner = new Spinner('%s Connecting to ' + hostname);
        connectSpinner.setSpinnerString('|/-\\');
        connectSpinner.start();

        return Promise
          .delay(1000)
          .then(function () {
            return client.connectAsync();
          })
          .then(function () {
            connectSpinner.stop();
            console.log('');
            queueSpinner.start();
            if (!options.has('dry')) {
              client.publish(queueName, { githubId: org });
            }
          })
          .delay(500)
          .then(function () {
            queueSpinner.stop();
            return client.closeAsync();
          })
          .then(function () {
            var jobText = ('{"githubId": "' + org + '"}').magenta;
            if (options.has('dry')) {
              return '✘'.yellow + ' Not Published (dry): ' + jobText;
            }
            return '✓'.green + ' Published: ' + jobText;
          })
          .finally(function() {
            sshTunnel.kill();
          });
      });
  }
};
