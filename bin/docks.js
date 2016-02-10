'use strict'
var program = require('commander')
var version = require('../package.json').Version

program
  .version(version)
  .command('list', 'list available docks')
  .parse(process.argv)
