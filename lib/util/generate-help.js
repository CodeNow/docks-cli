'use strict'

var isEmpty = require('101/is-empty')
var isObject = require('101/is-object')
var isString = require('101/is-string')
var exists = require('101/exists')
var options = require('./options')
var printf = require('printf')
var Promise = require('bluebird')
var text = require('./text')

/**
 * Utility function for generating action help entries.
 * @param {object} opts Options for the help generator.
 * @param {string} opts.name Name of the action.
 * @param {string} opts.description Description for the action.
 * @param {object} opts.subActions A map of sub-action names to descriptions.
 * @param {boolean} opts.hasOptions Whether or not help for the action should
 *   be displayed with an options list.
 * @return {Promise} A promise that resolves with the help text.
 */
module.exports = function generateHelp (opts) {
  return Promise.try(function () {
    if (!isObject(opts)) {
      throw new Error('Cannot generate help.')
    }

    var hasOptions = exists(opts.hasOptions) ? opts.hasOptions : true
    var hasSubActions = isObject(opts.subActions)

    if (!isString(opts.name)) {
      throw new Error('Cannot generate help, name not given.')
    }
    var name = opts.name

    if (!isString(opts.description)) {
      throw new Error(
        'Cannot generate help for ' + name + ' without description.'
      )
    }
    var description = opts.description

    var preamble = 'Action: ' + name + '\n' + 'Usage: ' + 'docks'.magenta +
    ' ' + name.yellow

    if (hasSubActions) {
      preamble += ' ' + '<sub-action>'.green
    }

    if (hasOptions) {
      preamble += ' [options...]'.cyan.italic
    }

    if (!isEmpty(description)) {
      preamble += '\n\n' + text.fixedWidth(description) + '\n'
    }

    var help = [preamble]

    if (hasSubActions) {
      var subActionsKeys = Object.keys(opts.subActions)
      subActionsKeys.sort()
      help.push('Sub Actions:\n\n' + subActionsKeys.map(function (subActionName) {
        var sub = opts.subActions[subActionName]

        if (isString(sub)) {
          return '  ' + subActionName.green +
          '\n' + text.fixedWidth(sub, 80, 2)
        }

        if (isObject(sub)) {
          let entry = '  ' + subActionName.green
          if (isString(sub.options)) {
            entry += ' ' + sub.options.cyan
          }
          return entry + '\n    ' + text.fixedWidth(sub.description, 80, 2)
        }

        return ''
      }).join('\n\n') + '\n')
    }

    if (hasOptions) {
      var optionKeys = Object.keys(options.all())
      optionKeys.sort()
      var maxKeyLength = optionKeys.reduce(function (p, c) {
        return (c.length > p) ? c.length : p
      }, 0)

      var optionHelp = options.allHelp()
      var maxParamsLength = optionKeys.reduce(function (p, c) {
        var len = optionHelp[c].parameters.length
        return (len > p) ? len : p
      }, 0)

      help.push('Options:\n\n' + optionKeys.map(function (key) {
        var help = optionHelp[key]
        return printf('    -%1s', help.short).yellow +
        printf('  --%-' + maxKeyLength + 's', help.long) +
        printf(
          ' %-' + maxParamsLength + 's\n        %s',
          help.parameters,
          help.text
        )
      }).join('\n\n'))
    }

    return help.join('\n')
  })
}
