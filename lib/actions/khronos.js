'use strict';

var CLIError = require('../errors/cli-error');
var generateHelp = require('../util/generate-help');
var InvalidArgumentError = require('../errors/invalid-argument-error');
var options = require('../util/options');
var printf = require('printf');
var Promise = require('bluebird');
var question = require('../util/question');
var rabbit = require('../util/rabbit');
var readline = require('readline');

/**
 * Action for running khronos tasks.
 * @module docks-cli:actions:khronos
 */
module.exports = {
  /**
   * Sets options for the khronos action.
   * @return {Promise} Resolves after the options have been set.
   */
  options: function () {
    return Promise.try(function () {
      options.set(
        'list',
        'l',
        undefined,
        '',
        'List the available tasks in Khronos.'
      );

      options.set(
        'dry',
        'd',
        undefined,
        '',
        'Perform a dry run of the khronos action (job is not enqueued)'
      );
    });
  },

  /**
   * Help for the khronos action.
   * @return {Promise} Resolves with the help for this action.
   */
  help: function () {
    return generateHelp('khronos', [
      'The `' + 'khronos'.yellow + '` action enqueues a task to perform a',
      'task in the khronos environment. Run with ' + '--list'.cyan + ' to see',
      'the available tasks.'
    ].join(' '))
  },

  /**
   * Executes the khronos action.
   * @return {Promise} Resolves after the dock provision has been initiated.
   */
  execute: function () {
    var taskList = Object.keys(this._tasks);
    return Promise.resolve().bind(this)
      .then(function () {
        if (options.has('list')) {
          return 'Available Tasks:\n'.green + taskList.join('\n');
        } else {
          return question.list(
            'What task would you like to accomplish?',
            taskList
          ).bind(this)
          .then(function (answer) {
            // answer is a 1-based index of taskList. it is a Number.
            var targetQueue = this._tasks[taskList[answer - 1]]
            return rabbit.publish(targetQueue, {});
          });
        }
      });
  },

  _tasks: {
    'Clean image-builder Containers from Docks': 'khronos:containers:image-builder:prune',
    'Clean Old Images from Docks': 'khronos:images:prune',
    'Clean Old Weave Containers from Docks': 'khronos:weave:prune',
    'Remove Expired Context Versions from Mongo': 'khronos:context-versions:prune-expired',
    'Remove Orphan Containers from Docks': 'khronos:containers:orphan:prune'
  }
};
