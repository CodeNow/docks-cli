// 'use strict'; - can't use strict mode with this type of inherits...

var CLIError = require('./cli-error')
var util = require('util')

/**
 * Error thrown when an action has been aborted by the user.
 */
var AbortedError = module.exports = function AbortedError (message) {
  CLIError.call(this, message)
  this.level = 'warning'
}
util.inherits(AbortedError, CLIError)
