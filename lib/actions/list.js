'use strict'

require('../util/text')
const Promise = require('bluebird')
const Table = require('cli-table')
const github = require('../util/github')
const mavis = require('../util/mavis')
const moment = require('moment')
const program = require('commander')

module.exports = function listDocks () {
  const description = [
    'The `' + 'list'.yellow + '` action lists docks that are currently ',
    'in-rotation (handling user requests) in the Runnable infrastructure.',
    'The list can be filtered and pruned via the options detailed below ',
    '(by org, by number of builds, etc.).'
  ].join(' ')

  program
    .description(description)
    .option('-e, --env <env>', 'Environment to get docks', 'gamma')
    .option('-g, --github', 'Fetch GitHub organization names')
    .option('-o, --org', 'Filter results by organization ID')
    .parse(process.argv)

  const startTime = moment()
  return mavis.list(program)
    .then(function (docks) {
      // If they specified an organization, filter by that org id (partial
      // filtering allows to just give the first couple of characters)
      if (program.options.org) {
        docks = docks.filter(function (dock) {
          return dock.org.match(new RegExp('^' + program.options.org)) !== null
        })
      }

      // Sort the result set by organization ascending, and then by host ip asc
      docks.sort(function (a, b) {
        if (a.org === b.org) {
          var octetsA = a.ip.split('.').map(parseInt)
          var octetsB = b.ip.split('.').map(parseInt)
          for (var i = 3; i >= 0; i--) {
            if (octetsA[i] === octetsB[i]) { continue }
            if (octetsA[i] < octetsB[i]) { return -1 }
            return 1
          }
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
      if (!program.options.github) {
        return docks
      }
      return Promise.map(docks, function (dock) {
        var githubName = github.idToName(dock.org)
        return githubName.then(function (name) {
          dock.github = name || ''
          return dock
        })
      })
    })
    .then(function renderTables (docks) {
      // Build and resolve with the results table
      var table
      if (!program.options.github) {
        table = new Table({
          head: ['Org', 'IP', 'Builds', 'Full Host'],
          colWidths: [12, 16, 10, 31]
        })
      } else {
        table = new Table({
          head: ['Org', 'GitHub', 'IP', 'Builds', 'Full Host'],
          colWidths: [12, 16, 16, 10, 31]
        })
      }

      docks.forEach(function (dock) {
        var data = [
          dock.org,
          // where dock.github would go
          dock.ip,
          dock.builds,
          dock.host
        ]
        if (program.options.github) {
          data.splice(1, 0, dock.github)
        }
        table.push(data)
      })

      const endTime = moment()
      const duration = moment.duration(startTime.diff(endTime)).humanize()
      return [
        table.toString(),
        '✓'.green + ' Query complete in ' + duration
      ].join('\n\n')
    })
}
