'use strict'

require('../util/text')
const CLIError = require('../errors/cli-error')
const Promise = require('bluebird')
const aws = require('../util/aws')
const hasProps = require('101/has-properties')
const rabbit = require('../util/rabbit')
const program = require('commander')

module.exports = Promise.method(function scaleOutASGs () {
  const description = 'Scale-in all instances for a group'

  program
    .description(description)
    .arguments('<org>')
    .option('-d, --dry', 'Dry Run (do not publish)', false)
    .option('-e, --env <env>', 'Environment to get docks', 'gamma')
    .parse(process.argv)

  if (program.args.length < 1) {
    console.error('\n  <org> is required')
    return program.help()
  }

  program.org = program.args.shift().toString()

  return aws.listAutoScalingGroups(program)
    .then(function (groups) {
      var foundGroup = groups.find(hasProps({ org: program.org }))
      if (!foundGroup) {
        var message = "The ASG for the organization you've specified (" +
          program.org + ') does not exist. Did you remember to pass an ' +
          'environemnt (`--environment`)?'
        throw new CLIError(message)
      }
      return foundGroup
    })
    .then(function (group) {
      var org = program.org.toString()

      var data = {
        MinSize: 0,
        DesiredCapacity: 0,
        MaxSize: 0
      }

      return rabbit.publish('asg.update', { githubId: org, data: data }, program)
    })
})
