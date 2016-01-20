'use strict';

var isFunction = require('101/is-function');
var isObject = require('101/is-object');
var Promise = require('bluebird');

/**
 * The master list of CLI actions.
 * @type {object}
 */
var actions = {
  help: {
    help: 'Outputs this list of actions that can be taken via the CLI.',
    module: require('./help')
  },
  list: {
    help: 'Lists docks that are in rotation along with stats.',
    module: require('./list')
  },
  unhealthy: {
    help: 'Marks docks as unhealthy and in need of replacement.',
    module: require('./unhealthy')
  },
  aws: {
    help: 'Lists dock instances that are in the VPC infrastructure on AWS.',
    module: require('./aws')
  },
  kill: {
    help: 'Kills AWS dock instances and removes them from rotation.',
    module: require('./kill')
  },
  logs: {
    help: 'Fetches and displays various dock service logs.',
    module: require('./logs')
  },
  remove: {
    help: 'Removes docks from rotation.',
    module: require('./remove')
  },
  weave: {
    help: 'Displays the weave network for organization clusters',
    module: require('./weave')
  },
  asg: {
    help: 'Actions for handling AWS Auto-Scaling Groups',
    module: require('./asg')
  },
  khronos: {
    help: 'Enqueue Khronos tasks.',
    module: require('./khronos')
  },
  ghost: {
    help: 'Get duplicated containers.',
    module: require('./ghost')
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
