'use strict';

var exists = require('101/exists');
var isFunction = require('101/is-function');

var args = require('minimist')(process.argv);
var options = {};
var optionHelp = {};

/**
 * Command-line argument options module.
 * @module dock-cli:util:options
 * @author Ryan Sandor Richards
 */
module.exports = {
  /**
   * @return the help entry for the given option .
   * @param {string} name Name of the option.
   */
  help: function (name) {
    return optionHelp[name];
  },

  /**
   * @return The help entries for all options.
   */
  allHelp: function () {
    return optionHelp;
  },

  /**
   * @return {object} All options.
   */
  all: function getAllOptions() {
    return options;
  },

  /**
   * Sets a script option based on command-line arguments.
   * @param {string} name Long name of the option.
   * @param {string} short Single-letter short name for the option.
   * @param {mixed} def Default value for the option.
   * @param {string} helpParams Help text for option parameters.
   * @param {string} help Help text for the option.
   */
  set: function setOption(name, short, def, helpParams, help) {
    var defaultValue = isFunction(def) ? def() : def;
    if (!exists(defaultValue)) {
      defaultValue = NaN;
    }
    options[name] = args[name] || args[short] || defaultValue;
    optionHelp[name] = {
      long: name,
      short: short,
      parameters: helpParams,
      text: help
    };
  },

  /**
   * Determines if an option was set.
   * @param {string} name Name of the option to check.
   * @return `true` if the option was set, false otherwise.
   */
  has: function hasOption(name) {
    return exists(options[name]) && !Number.isNaN(options[name]);
  },

  /**
   * Gets the value for a specific option.
   * @param {string} name Name of the option.
   * @return The value of the option.
   */
  get: function getOption(name) {
    return options[name];
  }
};
