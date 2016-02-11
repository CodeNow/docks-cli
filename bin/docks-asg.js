'use strict'

var program = require('commander')

require('../lib/util/unhandled-catcher')()

program
  .command('list', 'Lists Auto-Scaling groups in the environment')
  .command('create', 'Creates a new Auto-Scaling group for an organization')
  .command('delete', 'Deletes an Auto-Scaling group with the given name')
  .command('off', 'Scale-in all instances for the group')
  .command('lc', 'Change the launch configuration for a group')
  .command('scale-out', 'Add instances to an auto-scaling group')
  .command('scale-in', 'Remove instances from an auto-scaling group')
  .parse(process.argv)
