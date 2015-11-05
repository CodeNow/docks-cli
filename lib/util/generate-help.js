'use strict';

var isEmpty = require('101/is-empty');
var exists = require('101/exists');
var options = require('./options');
var printf = require('printf');
var Promise = require('bluebird');

/**
 * A utility function that generates help for a action with a list of options.
 * @param {string} name Name of the action.
 * @param {string} [description] A detailed description of what the action does.
 * @param {boolean} [hasOptions=true] Whether or not the action has options.
 * @return {Promise} A promise that resolves with the help text.
 */
module.exports = function generateHelp(name, description, hasOptions) {
  return Promise.try(function () {
    if (!exists(hasOptions)) {
      hasOptions = true;
    }

    var preamble = 'Action: ' + name + '\n' + 'Usage: ' + 'docks'.magenta +
      ' ' + name.yellow;
    if (hasOptions) {
      preamble += ' [options...]'.cyan.italic;
    }

    if (!isEmpty(description)) {
      var fixedDescription = '';
      var len = 0;
      description.split(/\s+/).forEach(function (word) {
        if (len + word.length > 80) {
          fixedDescription += '\n' + word + ' ';
          len = word.length + 1;
        }
        else {
          fixedDescription += word + ' ';
          len += word.length + 1;
        }
      });
      preamble += '\n\n' + fixedDescription + '\n';
    }

    if (!hasOptions) {
      return preamble;
    }

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

    var optionsList = 'Options:\n' + optionKeys.map(function (key) {
      var help = optionHelp[key];
      return printf('    -%1s', help.short).yellow +
        printf('  --%-' + maxKeyLength + 's', help.long) +
        printf(
          ' %-' + maxParamsLength + 's\n        %s',
          help.parameters,
          help.text
        );
    }).join('\n\n');

    return [preamble, optionsList].join('\n');
  });
};
