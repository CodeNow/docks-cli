// 'use strict'; - can't use strict mode with this type of inherits...

var CLIError = require('./cli-error');
var util = require('util');

/**
 * Error thrown when an argument has an invalid value.
 */
var InvalidArgumentError =
  module.exports = function InvalidArgumentError(message) {
    CLIError.call(this, message);
    this.level = 'warning';
  };
util.inherits(InvalidArgumentError, CLIError);
