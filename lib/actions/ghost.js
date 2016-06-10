'use strict'

require('../util/text')
const Promise = require('bluebird')
const Table = require('cli-table')
const mongo = require('../util/mongo')
const program = require('commander')
const swarm = require('../util/swarm')
const moment = require('moment')

module.exports = Promise.method(function findGhosts () {
  const description = [
    'The `' + 'ghost'.yellow + '` action returns a list of containers that',
    'have duplicates'
  ].join(' ')

  program
    .description(description)
    .arguments('<org>')
    .option('-e, --env <env>', 'Environment to get docks', 'gamma')
    .parse(process.argv)

  var rawContainerCounts = {}

  const startTime = moment()
  return swarm.getAllContainers(program)
    .then(function (swarmContainers) {
      return mongo.getAllContainers(program)
        .then(function (mongoContainers) {
          return {
            swarmContainers: swarmContainers,
            mongoContainers: mongoContainers
          }
        })
    })
    .then(function (params) {
      var swarmContainers = params.swarmContainers
      var mongoContainers = params.mongoContainers

      var defaultGhost = 0
      var totalDefault = 0
      var ghostContainers = swarmContainers.filter(function (container) {
        rawContainerCounts[container.ownerUsername] = rawContainerCounts[container.ownerUsername] || 0
        rawContainerCounts[container.ownerUsername]++

        if (container.dockType === 'default') {
          totalDefault++
        }

        return !mongoContainers.find(function (mongoContainer) {
          return mongoContainer.container.dockerContainer === container.id
        })
      })

      var table = new Table({
        head: ['ContainerId', 'Owner Username', 'dock ip', 'Org Id', 'dock type', 'status']
      })

      var orgGhostContainers = {}
      ghostContainers
        .sort(function (a, b) {
          if (a.ownerUsername < b.ownerUsername) {
            return -1
          } else if (a.ownerUsername > b.ownerUsername) {
            return 1
          } else {
            return 0
          }
        })
        .forEach(function (container) {
          if (container.dockType === 'default') {
            defaultGhost++
          }
          orgGhostContainers[container.ownerUsername] = orgGhostContainers[container.ownerUsername] || 0
          orgGhostContainers[container.ownerUsername]++
          table.push([
            container.id || '-',
            container.ownerUsername  || '-',
            container.dockIp || '-',
            container.orgId || '-',
            container.dockType || '-',
            container.status || '-'
          ])
        })

      var orgDetailsTable = new Table({
        head: [
          'Owner Username',
          'Total Containers',
          'Ghost Containers',
          'Real Containers',
          'Percent Ghost Containers'
        ]
      })
      Object.keys(rawContainerCounts).forEach(function (key) {
        orgGhostContainers[key] = orgGhostContainers[key] || 0
        orgDetailsTable.push([
          key,
          rawContainerCounts[key],
          orgGhostContainers[key],
          rawContainerCounts[key] - orgGhostContainers[key],
          ((orgGhostContainers[key] / rawContainerCounts[key]) * 100).toFixed(2) + '%'
        ])
      })

      function getPercent (number) {
        return ((number / swarmContainers.length) * 100).toFixed(2) + '%'
      }
      var statsTable = new Table({
        head: ['Type', 'Count', 'Percent of All']
      })
      statsTable.push(
        ['All', swarmContainers.length, getPercent(swarmContainers.length)],
        ['Ghost', ghostContainers.length, getPercent(ghostContainers.length)],
        ['Real', (swarmContainers.length - ghostContainers.length), getPercent((swarmContainers.length - ghostContainers.length))],
        ['All Default', totalDefault, getPercent(totalDefault)],
        ['Default Ghost', defaultGhost, getPercent(defaultGhost)],
        ['Default Real', (totalDefault - defaultGhost), getPercent(totalDefault - defaultGhost)]
      )

      const endTime = moment()
      const duration = moment.duration(startTime.diff(endTime)).humanize()
      return [
        table.toString(),
        orgDetailsTable.toString(),
        statsTable.toString(),
        '✓'.green + ' Query complete in ' + duration
      ].join('\n\n')
    })
})
