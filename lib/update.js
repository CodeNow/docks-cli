'use strict'

const childProcess = require('child_process')
const fs = require('fs')
const moment = require('moment')
const path = require('path')
const Promise = require('bluebird')
const util = require('util')

const execFile = Promise.promisify(childProcess.execFile)

const UPDATE_FILE = path.resolve(process.env.HOME, '.docks-update')
const DEFAULT_OPTS = {
  cwd: __dirname,
  env: process.env
}

function DoNotUpdateError (message) {
  Error.call(this)
  this.message = `Not Updating: ${message}`
}
util.inherits(DoNotUpdateError, Error)

function checkCurrentBranchIsMaster () {
  return execFile(
    'git',
    [ 'rev-parse', '--abbrev-ref', 'HEAD' ],
    DEFAULT_OPTS
  )
    .then((buff) => {
      if (buff.toString().trim() !== 'master') {
        throw new DoNotUpdateError('not on master')
      }
    })
}

function checkIfWorkingDirectoryDirty () {
  return execFile(
    'git',
    [ 'diff-files', '--quiet' ],
    DEFAULT_OPTS
  )
    .catch(() => {
      throw new DoNotUpdateError('dirty working directory')
    })
}

function getLatestLocalCommit () {
  return execFile(
    'git',
    [ 'rev-parse', 'HEAD' ],
    DEFAULT_OPTS
  )
    .then((buff) => {
      return buff.toString().trim()
    })
}

function getLatestRemoteCommit () {
  return execFile(
    'git',
    [ 'fetch', '--quiet', 'origin' ],
    DEFAULT_OPTS
  )
    .then(() => {
      return execFile(
        'git',
        [ 'rev-parse', 'origin/master' ],
        DEFAULT_OPTS
      )
    })
    .then((buff) => {
      return buff.toString().trim()
    })
}

function checkIfLatestCommit () {
  return Promise.props({
    local: getLatestLocalCommit(),
    remote: getLatestRemoteCommit()
  })
    .then((data) => {
      if (data.local === data.remote) {
        throw new DoNotUpdateError('already on latest commit')
      }
    })
}

function updateMaster () {
  return execFile(
    'git',
    [ 'pull', 'origin', 'master' ],
    DEFAULT_OPTS
  )
}

function readDateFromFile () {
  return Promise.fromCallback((callback) => {
    fs.readFile(UPDATE_FILE, (err, buff) => {
      if (err) { return callback(null, moment().subtract(2, 'days')) }
      callback(null, moment(buff.toString()))
    })
  })
}

function saveDateToFile () {
  return Promise.fromCallback((callback) => {
    fs.writeFile(UPDATE_FILE, moment().toISOString(), callback)
  })
}

function checkIfWaitedLongEnough () {
  return readDateFromFile()
    .then((lastReadDate) => {
      const now = moment()
      if ((now - lastReadDate) / 1000 <= 24 * 60 * 60) {
        throw new DoNotUpdateError('will not check for updates too often')
      }
    })
}

module.exports = function () {
  return checkCurrentBranchIsMaster()
    .then(checkIfWorkingDirectoryDirty)
    .then(checkIfLatestCommit)
    .then(checkIfWaitedLongEnough)
    .then(updateMaster)
    .then(() => {
      console.log('docks has been updated to latest master version')
    })
    .then(saveDateToFile)
    .catch((err) => {
      if (!(err instanceof DoNotUpdateError)) {
        throw err
      } else if (process.env.DEBUG) {
        console.error(err.message || err)
      }
    })
}
