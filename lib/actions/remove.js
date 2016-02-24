'use strict'

const Promise = require('bluebird')
const mavis = require('../util/mavis')
const program = require('commander')

module.exports = Promise.method(function removeDock () {
  const description = [
    'The `' + 'remove'.yellow + '` action is used remove a dock from rotation.',
    'Note: the dock will not be terminated, simply removed from build and run',
    'rotation in mavis.'
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

  return mavis.remove(program)
    .then(function () {
      return '✓'.green + ' Dock removed from rotation'
    })
})
