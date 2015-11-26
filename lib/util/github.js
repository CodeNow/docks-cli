'use strict';
var request = require('request');

/**
 * Module for interacting with GitHub API
 * @module docks-cli:util:github
 */
module.exports = {
  idToName: function (id) {
    return new Promise(function (resolve, reject) {
      if (id === 'default') {
        return resolve('n/a');
      }
      // client and secret is take from dedicated app
      // https://github.com/organizations/CodeNow/settings/applications/266779
      var url = 'https://api.github.com/user/' + id +
        '?client_id=' + 'a1efab2a8657006ae36a' +
        '&client_secret=' + '762e4a7f9da0a69aa0b99b73790cd2c4cbcc72fc';
      var requestOptions = {
        url: url,
        json: true,
        headers: {
          'User-Agent': 'Runnable Docks CLI'
        }
      };

      request.get(requestOptions, function (err, data) {
        if (err) { return reject(err); }
        resolve(data.body.login);
      });
    });
  }
}
