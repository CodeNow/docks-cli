'use strict'

require('../util/text')
const program = require('commander')
const question = require('../util/question')
const rabbit = require('../util/rabbit')

module.exports = function killDock () {
  const description = [
    'The `' + 'kill'.yellow + '` action will terminate a dock with the ',
    'given AWS private ip and remove it from rotation in mavis.'
  ].join(' ')

  program
    .description(description)
    .arguments('<ip>')
    .option('-d, --dry', 'Dry Run (do not publish)', false)
    .option('-e, --env <env>', 'Environment to get docks', 'gamma')
    .parse(process.argv)

  if (program.args.length < 1) {
    console.error('\n  <ip> is required')
    return program.help()
  }

  program.ip = program.args.shift().toString()

  const killAbortMessage = 'Aborted dock destruction'

  const killWarning = [
    ':bangbang: :bangbang: '.emoji,
    'UNHEALTHY will KILL the dock.',
    ':bangbang: :bangbang: '.emoji,
    'Are you SURE you want to KILL the dock with ip',
    program.ip.cyan
  ].join(' ')

  return question.yesno(killWarning, killAbortMessage)
    .then(function () {
      return question.yesno(
        'Are you sure you wish to kill the dock with ip ' + program.ip.cyan,
        killAbortMessage
      )
    })
    .then(function () {
      const job = { ipAddress: program.ip }
      return rabbit.publish('asg.instance.terminate', job, program)
    })
}
