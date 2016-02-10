// 'use strict'; - can't use strict mode with this type of inherits...

var util = require('util')

/**
 * Base error class for all errors thrown by actions in the CLI.
 */
function CLIError (message) {
  Error.call(this)
  Error.captureStackTrace(this, CLIError)
  this.message = message
  this.level = 'error'
}
util.inherits(CLIError, Error)

/**
 * @return A nicely formatted message to display in the command-line.
 */
CLIError.prototype.toString = function () {
  var prefix = ''
  if (this.level === 'error') { prefix = '✘ '.red }
  if (this.level === 'warning') { prefix = '✘ '.yellow }
  if (this.level === 'dry') { prefix = '✓ '.yellow }
  var postfix = ''
  if (this.level === 'dry') { postfix = ' (dry run)' }
  return prefix + this.message + postfix
}

module.exports = CLIError
