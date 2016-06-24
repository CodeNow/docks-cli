'use strict'

require('../util/text')
const CLIError = require('../errors/cli-error')
const Promise = require('bluebird')
const aws = require('../util/aws')
const hasProps = require('101/has-properties')
const rabbit = require('../util/rabbit')
var program = require('commander')

module.exports = Promise.method(function scaleOutASGs () {
  const description = 'Add instances to an auto-scaling group'

  program
    .description(description)
    .arguments('<org> <number>')
    .option('-d, --dry', 'Dry Run (do not publish)', false)
    .option('-e, --env <env>', 'Environment to get docks', 'gamma')
    .parse(process.argv)

  if (program.args.length < 2) {
    console.error('\n  <org> and <number> are required')
    return program.help()
  }

  program.org = program.args.shift().toString()
  program.number = parseInt(program.args.shift())

  return aws.listAutoScalingGroups(program)
    .then(function (groups) {
      var foundGroup = groups.find(hasProps({ org: program.org }))
      if (!foundGroup) {
        var message = "The group you've specified does not exist."
        message += ' Did you remmember to pass an environemnt (`--environment`)?'
        throw new CLIError(message)
      }
      return foundGroup
    })
    .then(function (group) {
      var org = program.org
      var number = program.number

      if (number <= 0) {
        throw new CLIError('Scale in number must be greater than 0')
      }

      var data = {
        DesiredCapacity: group.desired + number
      }

      return rabbit.publish('asg.update', { githubId: org, data: data }, program)
    })
})
