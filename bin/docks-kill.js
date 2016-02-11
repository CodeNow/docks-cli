'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/kill')()
  .then(console.log.bind(console))
