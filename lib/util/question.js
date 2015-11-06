'use strict';

var AbortedError = require('../errors/aborted-error');
var isEmpty = require('101/is-empty');
var Promise = require('bluebird');
var readline = require('readline');
var trim = require('trim');

/**
 * Module for asking questions in the command-line in a promisified way.
 * @module docks-cli:question
 */
module.exports = {
  /**
   * Asks a question on the commandline and resolves with the answer.
   * @param {string} question The question to ask.
   * @param {string} [defaultAnswer] The default answer.
   * @return {Promise} Resolves with the user's answer.
   */
  ask: function (question, defaultAnswer) {
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    return new Promise(function (resolve, reject) {
      rl.question(question, function (answer) {
        rl.close();
        resolve(isEmpty(trim(answer)) ? defaultAnswer : trim(answer));
      });
    });
  },

  /**
   * Asks a yes/no question.
   * @param {string} question The question to ask.
   * @param {string} rejectMessage Message for the error on rejection.
   * @return {Promise} Resolves on 'yes' and rejects on 'no'.
   */
  yesno: function (question, rejectMessage) {
    return this.ask(':interrobang:  '.emoji + question + ' [y/N]: ', 'no')
      .then(function (answer) {
        if (answer.toLowerCase().charAt(0) !== 'y') {
          throw new AbortedError(rejectMessage);
        }
        return answer;
      });
  }
};
