'use strict'

var Promise = require('bluebird')
var path = require('path')
var execFile = Promise.promisify(require('child_process').execFile, { multiArgs: true })

var executablePath = path.join(__dirname, '..', 'bin', 'docks')

module.exports = function () {
  this.When(/^I successfully run `docks (.+)`$/, function (args) {
    return execFile(executablePath, args.split(' '), {})
      .bind(this)
      .spread(function (stdout, stderr) {
        this.lastRun = {
          stdout: stdout,
          stderr: stderr
        }
      })
      .catch(function (err) {
        this.lastRun.error = err
      })
  });

  this.Then(/^the output should contain:$/, function (expectedOutput) {
    return Promise.try(function () {
      var actualOutput = this.lastRun.stdout.toString()

      if (actualOutput.indexOf(expectedOutput) === -1) {
        throw new Error('Expected output to contain the following:\n' + expectedOutput + '\n' +
          'Got:\n' + actualOutput + '\n')
      }
    }.bind(this))
  });

  this.Then(/^the exit status should be (\d+)$/, function (expectedCode) {
    return Promise.try(function () {
      var actualCode = this.lastRun.error ? this.lastRun.error.code : 0

      var okay = actualCode === 0

      if (!okay) {
        throw new Error('Expected exit code: ' + expectedCode + '\n' +
          'Got: ' + actualCode + '\n')
      }
    }.bind(this))
  });
}
