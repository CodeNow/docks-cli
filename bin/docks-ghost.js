'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/ghost')()
  .then(console.log.bind(console))
