'use strict';

var actions = require('./actions/index');
var options = require('./util/options');

/**
 * Main function for the script.
 */
module.exports = function main() {
  // Determine the action the user is trying to execute
  var actionName = 'list'
  if (process.argv.length >= 3 && !process.argv[2].match(/^\-/)) {
    actionName = process.argv[2];
  }

  if (!actions.exists(actionName)) {
    console.error('[Error]'.red + ' Unknown action: ' + process.argv[2].cyan);
    console.log(
      '\nRun `' + 'docks'.cyan + ' ' + 'help'.yellow +
      '` for a full list of actions.'
    );
    process.exit(1);
  }

  actions.options(actionName)
    .then(function () {
      if (options.has('help')) {
        return actions.help(actionName);
      }
      return actions.execute(actionName);
    })
    .then(function (result) {
      console.log('\n' + result);
    })
    .catch(function (err) {
      console.error('[Error]'.red + ' ' + err.message + '\n' + err.stack);
    });
};
