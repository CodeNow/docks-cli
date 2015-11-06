'use strict';

var isFunction = require('101/is-function');
var isObject = require('101/is-object');
var Promise = require('bluebird');

/**
 * The master list of CLI actions.
 * @type {object}
 */
var actions = {
  /**
   * `help` displays the avaiable CLI actions.
   */
  help: {
    help: 'Outputs this list of actions that can be taken via the CLI.',
    module: require('./help')
  },

  /**
   * `list` displays a list of docks based on filter options.
   */
  list: {
    help: 'Lists docks that are in rotation along with stats.',
    module: require('./list')
  },

  /**
   * `provision` will provision new docks for an org on EC2.
   */
  provision: {
    help: 'Provisions new EC2 docks for an organization.',
    module: require('./provision')
  },

  /**
   * `unhealthy` marks docks as unhealthy.
   */
  unhealthy: {
    help: 'Marks docks as unhealthy and in need of replacement.',
    module: require('./unhealthy')
  },

  /**
   * `aws` lists dock EC2 instances in the VPC
   */
  aws: {
    help: 'Lists dock instances that are in the VPC infrastructure on AWS.',
    module: require('./aws')
  },

  /**
   * `kill` kills and EC2 instance dock and removes it from rotation.
   */
  kill: {
    help: 'Kills AWS dock instances and removes them from rotation.',
    module: require('./kill')
  },

  /**
   * `logs` fetches the contents of a log file on a dock and
   * displays it.
   */
  logs: {
    help: 'Fetches and displays various dock service logs',
    module: require('./logs')
  }
};

/**
 * Methods for handling actions.
 * @module docks-cli:actions
 */
module.exports = {
  /**
   * @return {object} The name to action map for the CLI.
   */
  all: function () {
    return actions;
  },

  /**
   * Determines whether or not an action with the given name exists.
   * @param {string} name Name of the action to check.
   * @return {boolean} `true` if the action exists, `false` otherwise.
   */
  exists: function (name) {
    return isObject(actions[name]);
  },

  /**
   * Gets an action with the given name.
   * @param {string} name Name of the action.
   */
  get: function (name) {
    return actions[name];
  },

  /**
   * Calls the options handler for the action with the given name.
   * @param {string} name Name of the action.
   * @return {Promise} A promise that resolves once the options have been
   *   handled for the action.
   */
  options: function (name) {
    return Promise
      .try(function () {
        if (!this.exists(name)) {
          throw new Error('Unknown action: ' + name);
        }
        var action = this.get(name);
        if (!isFunction(action.module.options)) {
          throw new Error('Cannot handle options action: ' + name);
        }
        return action.module.options();
      }.bind(this));
  },

  /**
   * Executes the action with the given name.
   * @param {string} name Name of the action.
   * @return {Promise} Resolves with the results of the action.
   */
  execute: function (name) {
    return Promise
      .try(function () {
        if (!this.exists(name)) {
          throw new Error('Unknown action: ' + name);
        }
        var action = this.get(name);
        if (!isFunction(action.module.execute)) {
          throw new Error('Cannot execute action: ' + name);
        }
        return action.module.execute();
      }.bind(this));
  },

  /**
   * Displays the specific help for an action.
   * @param {string} name Name of the action.
   * @return {Promise} Resolves with the results of the action's help handler.
   */
  help: function (name) {
    return Promise
      .try(function () {
        if (!this.exists(name)) {
          throw new Error('Unknown action: ' + name);
        }
        var action = this.get(name);
        if (!isFunction(action.module.help)) {
          throw new Error('Cannot generate help for action: ' + name);
        }
        return action.module.help();
      }.bind(this));
  }
};
