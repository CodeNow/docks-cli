'use strict'

var Promise = require('bluebird')
var express = require('express')

module.exports = function () {
  this.Before(function () {
    this.app = express()
    this.app.get('/docks', function (req, res, next) {
      res.json(this.availableDocks)
    }.bind(this))

    return Promise.fromCallback(function (callback) {
      this._server = this.app.listen(6777, callback)
    }.bind(this))
  })

  this.After(function () {
    if (this._server) {
      return Promise.fromCallback(function (callback) {
        this._server.close(callback)
      }.bind(this))
    }
  })
}
