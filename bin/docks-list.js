'use strict'

require('../lib/actions/list')()
  .then(function (result) {
    console.log(result)
  })
  .catch(function (err) {
    console.error(err.stack || err.message)
  })
