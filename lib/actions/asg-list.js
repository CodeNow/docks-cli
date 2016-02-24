'use strict'

require('../util/text')
const aws = require('../util/aws')
const Table = require('cli-table')
const moment = require('moment')
var program = require('commander')

module.exports = function listASGs () {
  const description = 'Lists Auto-Scaling groups in the environment'

  program
    .description(description)
    .option('-e, --env <env>', 'Environment to get docks', 'gamma')
    .option('-o, --org', 'Organization to which the auto-scale group belongs')
    .parse(process.argv)

  const startTime = moment()
  return aws.listAutoScalingGroups(program)
    .then(function (groups) {
      var table = new Table({
        head: [
          'Name',
          'Org',
          'Min',
          'Desired',
          'Max',
          'Launch Configuration',
          'Cooldown',
          'Created'
        ],
        colWidths: [32, 12, 6, 10, 6, 34, 12, 41]
      })

      groups.forEach(function (group) {
        table.push([
          group.name,
          group.org,
          group.min,
          group.desired,
          group.max,
          group.launchConfiguration,
          group.cooldown,
          group.created
        ])
      })

      const endTime = moment()
      const duration = moment.duration(startTime.diff(endTime)).humanize()
      return [
        table.toString(),
        '✓'.green + ' Query complete in ' + duration
      ].join('\n\n')
    })
}
