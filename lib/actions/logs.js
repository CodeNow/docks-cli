'use strict'

require('../util/text')
const Promise = require('bluebird')
const spawn = require('child_process').spawn
const program = require('commander')

/**
 * Maps service names to log file paths.
 * @type {object}
 */
const servicePaths = {
  'charon': '/var/log/charon.log',
  'dock-init': '/var/log/user-script-dock-init.log',
  'docker-listener': '/var/log/docker-listener.log',
  'docker': '/var/log/upstart/docker.log',
  'filibuster': '/var/log/filibuster.log',
  'krain': '/var/log/krain.log',
  'sauron': '/var/log/sauron.log'
}

module.exports = Promise.method(function getLogs () {
  const description = [
    'The `' + 'logs'.yellow + '` action is used to get various dock service ',
    'logs and output them to the local terminal. Use the ', '--service'.cyan,
    'option for easy access without having to know the exact log path.'
  ].join(' ')

  program
    .description(description)
    .arguments('<ip> [service|path]')
    .option('-d, --dry', 'Dry Run (do not publish)', false)
    .option('-e, --env <env>', 'Environment to get docks', 'gamma')
    .option('-f, --follow', 'Follow the log')
    .parse(process.argv)

  if (program.args.length < 1) {
    console.error('\n  <ip> is required')
    return program.help()
  }

  program.ip = program.args.shift().toString()

  program.service = 'dock-init'
  if (program.args.length >= 1) {
    program.service = program.args.shift().toString()

    const fileRegex = new RegExp('/.+')
    if (fileRegex.test(program.service)) {
      program.path = program.service
    }
  }

  if (!program.path && Object.keys(servicePaths).indexOf(program.service) === -1) {
    console.error('\n  service specified is not valid')
    return program.help()
  } else if (!program.path) {
    program.path = servicePaths[program.service]
  }

  return new Promise(function (resolve, reject) {
    var path = program.path
    var cmd = 'sudo tail '
    if (program.follow) {
      cmd += ' -F '
    }
    cmd += path

    var args = [ program.ip, cmd ]
    var child = spawn('ssh', args)
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
    child.on('close', function (code) {
      resolve('✓'.green + ' Log tail complete')
    })
  })
})
