'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/remove')()
  .then(console.log.bind(console))
