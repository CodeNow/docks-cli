'use strict'

const CLIError = require('../errors/cli-error')
const Promise = require('bluebird')
const hasProps = require('101/has-properties')
const swarm = require('../util/swarm')
const program = require('commander')
const question = require('../util/question')
const rabbit = require('../util/rabbit')

module.exports = Promise.method(function () {
  const description = [
    'The `' + 'unhealthy'.yellow + '` action marks active docks as',
    'unhealthy and in need of replacement in the infrastructure.',
    'Note that this is a convience method that only sends ',
    '`dock.lost` event and then exits. It can take up',
    'to ten minutes for the replacement dock to appear in the `',
    'list'.yellow, '`.'
  ].join(' ')

  program
    .description(description)
    .arguments('<ip>')
    .option('-d, --dry', 'Dry Run (do not publish)', false)
    .option('-e, --env <env>', 'Environment to get docks', 'gamma')
    .option('-f, --force', 'Force job to be enqueued')
    .parse(process.argv)

  if (program.args.length < 1) {
    console.error('\n  <ip> is required')
    return program.help()
  }

  program.ip = program.args.shift().toString()

  return swarm.list(program)
    .then(function (docks) {
      const dock = docks.find(hasProps({ ip: program.ip }))
      if (!dock && !program.force) {
        throw new CLIError(
          'Dock with host ip ' + program.ip.cyan + ' not found.'
        )
      }
      return program.force ? (dock ? dock.org : 'unknown') : dock.org
    })
    .then(function (org) {
      org = org.toString()
      if (!program.dry) {
        var message = [
          'Are you sure you wish to mark ', program.ip.cyan,
          ' as unhealthy for org ', org.toString().yellow, '?'
        ].join('')

        return question.yesno(message, 'Aborted dock unhealthy').return(org)
      } else {
        return org
      }
    })
    .then(function (org) {
      var job = {
        host: 'http://' + program.ip + ':4242',
        githubOrgId: org
      }
      return rabbit.publishEvent('dock.lost', job, program)
    })
})
