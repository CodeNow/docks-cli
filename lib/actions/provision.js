'use strict';

var generateHelp = require('../util/generate-help');
var options = require('../util/options');
var Promise = require('bluebird');

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
        'production',
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
    return Promise.resolve('Not implemented');
  }
};
