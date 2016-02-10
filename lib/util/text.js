'use strict'

require('colors')
var emoji = require('node-emoji')

/**
 * Adds a getter property to the String object. Much convience.
 * @param {string} name Name of the property.
 * @param {function} func The function to call for the getter.
 */
function addProperty (name, func) {
  String.prototype.__defineGetter__(name, func)
}

/**
 * Useful extension for strings and text formatting.
 * @module docks-cli:util
 */
module.exports = {
  fixedWidth: fixedWidth
}

/**
 * Reformats a string so that it is of fixed width.
 * @param {Integer} cols Number of columns to fix the string width (default 80).
 * @param {Integer} indent Number of indentation spaces (default 0).
 * @return {string} The string fit to a fixed width
 */
function fixedWidth (string, cols, indent) {
  cols = cols || 80
  indent = indent || 0

  var indentSpaces = ''
  for (var i = 0; i < indent; i++) {
    indentSpaces += ' '
  }
  var fixed = '' + indentSpaces
  var lineLen = indent

  string.split(/\s+/).forEach(function (word) {
    var len = word.strip.length
    if (lineLen + len > 80) {
      fixed += '\n' + indentSpaces + word + ' '
      lineLen = indent + len + 1
    } else {
      fixed += word + ' '
      lineLen += len + 1
    }
  })
  return fixed
}

/**
 * Automatic emoji parsing and replacement as a getter.
 */
addProperty('emoji', function () {
  var matches = this.match(/(:[a-z_\-0-9]+:)/g)
  if (!matches) {
    return this
  }
  var result = this
  matches.forEach(function (emo) {
    result = result.replace(emo, emoji.get(emo))
  })
  return result
})
