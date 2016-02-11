'use strict'
var program = require('commander')
var version = require('../package.json').Version

program
  .version(version)
  .command('asg', 'list auto scale groups')
  .command('aws', 'list docks in AWS')
  // .command('ghost', 'look for ghost containers on docks')
  // .command('khronos', 'enqueue a job for khronos')
  .command('kill', 'kill (terminate) a dock')
  .command('list', 'list available docks')
  // .command('logs', 'get logs from a docks')
  // .command('remove', 'remove a dock from rotation')
  // .command('unhealthy', 'mark a dock as unhealthy')
  // .command('weave', 'I do not know what this does')
  .parse(process.argv)
