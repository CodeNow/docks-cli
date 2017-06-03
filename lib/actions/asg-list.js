'use strict'

require('../util/text')
const aws = require('../util/aws')
const hasProps = require('101/has-properties')
const moment = require('moment')
const program = require('commander')
const Table = require('cli-table')

module.exports = function listASGs () {
  const description = 'Lists Auto-Scaling groups in the environment'

  program
    .description(description)
    .option('-e, --env <env>', 'Environment to get docks', 'gamma')
    .option('-o, --org <org>', 'Organization to which the auto-scale group belongs')
    .parse(process.argv)

  const startTime = moment()
  return aws.listAutoScalingGroups(program)
    .then((groups) => {
      if (program.org) {
        return groups.filter(hasProps({ org: program.org.toString() }))
      } else {
        return groups
      }
    })
    .tap((groups) => {
      var fs = require('fs');
      fs.writeFile("/tmp/test", JSON.stringify(groups), function(err) {
          if(err) {
              return console.log(err);
          }

          console.log("The file was saved!");
      }); 
    })
    .then((groups) => {
      const table = new Table({
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

      groups.forEach((group) => {
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
