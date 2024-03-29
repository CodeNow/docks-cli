'use strict'
const program = require('commander')

const update = require('../lib/update')

const VERSION = require('../package.json').version

update()
  .then(() => {
    program
      .version(VERSION)
      .command('asg', 'list auto scale groups')
      .command('aws', 'list docks in AWS')
      .command('ghost', 'look for ghost containers on docks')
      .command('khronos', 'enqueue a job for khronos')
      .command('kill', 'kill (terminate) a dock')
      .command('list', 'list available docks')
      .command('logs', 'get logs from a docks')
      .command('unhealthy', 'mark a dock as unhealthy')
      .parse(process.argv)
  })
