// 'use strict'; - can't use strict mode with this type of inherits...

var CLIError = require('./cli-error')
var util = require('util')

/**
 * Error thrown when an action was performed with the --dry flag.
 */
var DryRunError = module.exports = function DryRunError (message) {
  CLIError.call(this, message)
  this.level = 'dry'
}
util.inherits(DryRunError, CLIError)
