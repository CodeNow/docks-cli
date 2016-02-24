'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/logs')()
  .then(console.log.bind(console))
