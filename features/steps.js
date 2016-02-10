'use strict'

var Promise = require('bluebird')
var path = require('path')
var execFile = Promise.promisify(require('child_process').execFile, { multiArgs: true })

var executablePath = path.join(__dirname, '..', 'bin', 'docks')

module.exports = function () {
  this.When(/^I run `docks (.+)`$/, function (args) {
		this.lastRun = {}
    return execFile(executablePath, args.split(' '))
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
      var actualOutput = this.lastRun.stdout

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

	this.Given(/^the following docks:$/, function (table) {
		return Promise.try(function () {
			this.availableDocks = table.hashes().map(function (o) {
				return {
					numContainers: 0,
					numBuilds: 0,
					host: 'http://' + o.ipAddress + ':4242',
          tags: o.organization + ',build,run'
				}
			})
		}.bind(this))
	});
}
