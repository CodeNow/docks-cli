'use strict';

var colors = require('colors');
var options = require('./util/options');
var trim = require('trim');

/**
 * Actions that can be performed by the CLI.
 * @type {object}
 */
var actions = {
  list: {
    module: require('./actions/list'),
    aliases: 'list ls'
  }
};

/**
 * Main function for the script.
 */
module.exports = function main() {
  // Setup the alias lookup table
  var actionNames = Object.keys(actions);
  var aliasLookup = {};
  actionNames.forEach(function (name) {
    var action = actions[name];
    action.aliases.split(/\s+/).map(trim).forEach(function (alias) {
      aliasLookup[alias] = name;
    });
    aliasLookup[name] = name;
  });

  // Determine the action the user is trying to execute
  var actionName = 'list'
  if (process.argv.length > 3 && !process.argv[2].match(/^\-/)) {
    actionName = aliasLookup[process.argv[2]];
  }
  if (!~actionNames.indexOf(actionName)) {
    console.err('[Error]'.red + ' Unknown action: ' + actionName.cyan.bold);
  }
  var action = actions[actionName].module;

  // Setup the options and run the action
  action.options()
  var method = options.has('help') ? action.help : action.execute;
  method()
    .then(function (result) {
      console.log('\n' + result);
    })
    .catch(function (err) {
      console.error('[Error]'.red + ' ' + err.message + '\n' + err.stack);
    });
};
