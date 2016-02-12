'use strict'

require('../util/text')
const Promise = require('bluebird')
const question = require('../util/question')
const rabbit = require('../util/rabbit')
const program = require('commander')

const tasks = {
  'Clean image-builder Containers from Docks': 'khronos:containers:image-builder:prune',
  'Clean Old Images from Docks': 'khronos:images:prune',
  'Clean Old Weave Containers from Docks': 'khronos:weave:prune',
  'Remove Expired Context Versions from Mongo': 'khronos:context-versions:prune-expired',
  'Remove Orphan Containers from Docks': 'khronos:containers:orphan:prune'
}

module.exports = Promise.method(function khronos () {
  const description = [
    'The `' + 'khronos'.yellow + '` action enqueues a task to perform a',
    'task in the khronos environment. Run with ' + '--list'.cyan + ' to see',
    'the available tasks.'
  ].join(' ')

  program
    .description(description)
    .option('-d, --dry', 'Dry Run (do not publish)', false)
    .option('-e, --env <env>', 'Environment to get docks', 'gamma')
    .option('-l, --list', 'List available tasks and exit')
    .parse(process.argv)

  const taskList = Object.keys(tasks)
  return Promise.resolve().bind(this)
    .then(function () {
      if (program.list) {
        return 'Available Tasks:\n'.green + taskList.join('\n')
      } else {
        return question.list(
          'What task would you like to accomplish?',
          taskList
        )
          .then(function (answer) {
            // answer is a 1-based index of taskList. it is a Number.
            var targetQueue = tasks[taskList[answer - 1]]
            return rabbit.publish(targetQueue, {}, program)
          })
      }
    })
})
