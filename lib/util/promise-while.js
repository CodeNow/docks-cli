'use strict'

var Promise = require('bluebird')

module.exports = function (condition, action) {
  function loop (data) {
    if (condition(data)) { return Promise.resolve(data) }
    return action(data).then(loop)
  }

  return loop
}
