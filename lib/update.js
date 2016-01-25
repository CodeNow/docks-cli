'use strict'

const childProcess = require('child_process')
const fs = require('fs')
const moment = require('moment')
const path = require('path')
const Promise = require('bluebird')

const execFile = Promise.promisify(childProcess.execFile)

const doNotUpdateError = new Error('do not update')
const UPDATE_FILE = path.resolve(process.env.HOME, '.docks-update')

const defaultOpts = {
  cwd: __dirname,
  env: process.env
}

function checkCurrentBranchIsMaster () {
  return execFile(
    'git',
    [ 'rev-parse', '--abbrev-ref', 'HEAD' ],
    defaultOpts
  )
    .then((buff) => {
      if (buff.toString().trim() !== 'master') {
        // throw doNotUpdateError
      }
    })
}

function checkIfWorkingDirectoryDirty () {
  return execFile(
    'git',
    [ 'diff-files', '--quiet' ],
    defaultOpts
  )
    .catch(() => {
      throw doNotUpdateError
    })
}

function getLatestLocalCommit () {
  return execFile(
    'git',
    [ 'rev-parse', 'HEAD' ],
    defaultOpts
  )
    .then((buff) => {
      return buff.toString().trim()
    })
}

function getLatestRemoteCommit () {
  return execFile(
    'git',
    [ 'fetch', '--quiet', 'origin' ],
    defaultOpts
  )
    .then(() => {
      return execFile(
        'git',
        [ 'rev-parse', 'origin/master' ],
        defaultOpts
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
        throw doNotUpdateError
      }
    })
}

function updateMaster () {
  return execFile(
    'git',
    [ 'pull', 'origin', 'master' ],
    defaultOpts
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
        throw doNotUpdateError
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
      if (err !== doNotUpdateError) {
        throw err
      }
    })
}
