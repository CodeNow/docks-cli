'use strict'

require('../util/text')
const Table = require('cli-table')
const aws = require('../util/aws')
const mavis = require('../util/mavis')
const moment = require('moment')
const program = require('commander')

module.exports = function listAWSDocks () {
  const description = [
    'The `' + 'aws'.yellow + '` action lists all docks that are running, ',
    'pending, or terminated in AWS EC2. This list may be different than',
    'that of the docks that are currently in rotation (as mavis uses a ',
    'different data model to track them).'
  ].join(' ')

  program
    .description(description)
    .option('-a, --ami', 'Fetch and display AMI information (slow)')
    .option('-d, --dead', 'Only show docks that are not in rotation')
    .option('-e, --env <env>', 'Environment to get docks', 'gamma')
    .option('-g, --github', 'Fetch GitHub organization names')
    .option('-l, --live', 'Only show docks that are in rotation')
    .option('-o, --org <org>', 'Filter results by organization ID')
    .option('-s, --state <state>', 'Only show instances with the given state')
    .parse(process.argv)

  const startTime = moment()
  return aws.list(program)
    .then(function (docks) {
      if (program.ami) {
        return aws.images(program)
          .then(function (images) {
            var imageMap = {}
            images.forEach(function (i) { imageMap[i.ImageId] = i })
            return imageMap
          })
          .then(function (map) {
            docks.forEach(function (d) {
              var ami = map[d.ami]
              d.ami = ami ? ami.Name : d.ami
            })
            return docks
          })
      }
      return docks
    })
    .then(function (docks) {
      docks.sort(function (a, b) {
        if (a.org === b.org && a.ip && b.ip) {
          var octetsA = a.ip.split('.').map(parseInt)
          var octetsB = b.ip.split('.').map(parseInt)
          for (let i = 3; i >= 0; i--) {
            if (octetsA[i] === octetsB[i]) { continue }
            if (octetsA[i] < octetsB[i]) { return -1 }
            return 1
          }
          return 0
        } else if (a.orgg === b.org) {
          return 0
        } else if (a.org.match('default')) {
          return 1
        } else if (b.org.match('default')) {
          return -1
        }
        return parseInt(a.org) < parseInt(b.org) ? -1 : 1
      })
      return docks
    })
    .then(function (docks) {
      if (!program.dead && !program.live) {
        return docks
      }
      return mavis.list()
        .then(function (live) {
          return docks.filter(function (dock) {
            var found = live.find(function (liveDock) {
              return liveDock.ip === dock.ip
            })
            return (found && program.live) || (!found && program.dead)
          })
        })
    })
    .then(function (docks) {
      if (!program.org) {
        return docks
      }
      return docks.filter(function (dock) {
        return dock.org.match(new RegExp('^' + program.org)) !== null
      })
    })
    .then(function (docks) {
      if (!program.state) {
        return docks
      }
      return docks.filter(function (dock) {
        return dock.state.match(new RegExp('^' + program.state)) !== null
      })
    })
    .then(function (docks) {
      var colWidths = [14, 12, 16, 14, 15, 20, 43]
      if (program.ami) {
        colWidths[4] = 40
      }

      var table = new Table({
        head: ['ID', 'Org', 'IP', 'Type', 'AMI', 'State', 'Launched'],
        colWidths: colWidths
      })

      docks.forEach(function (dock) {
        var state = dock.state
        if (state === 'running') {
          state = ('✓ ' + state).green
        } else if (state === 'terminated' || state === 'stopped') {
          state = ('✘ ' + state).red
        } else {
          state = ('✓ ' + state).yellow
        }
        table.push([
          dock.id || '',
          dock.org || '',
          dock.ip || '',
          dock.type || '',
          dock.ami || '',
          state || '',
          dock.launched || ''
        ])
      })

      var result = [
        table.toString(),
        '✓'.green + ' Query complete in ' +
        (((new Date().getTime()) - startTime) / 1000) + 's'
      ].join('\n\n').emoji

      if (program.live) {
        result = 'The following docks are ' + 'in rotation:\n'.green + result
      }

      if (program.dead) {
        result = 'The following docks are ' + 'not in rotation:\n'.red + result
      }

      return result
    })
}
