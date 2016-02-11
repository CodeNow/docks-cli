'use strict'

module.exports = function () {
  process.on('unhandledRejection', function (err) {
    console.error('Unhandled Rejection')
    console.error(err.stack || err.message || err)
    process.exit(2)
  })
}
