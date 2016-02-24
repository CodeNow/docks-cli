'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/list')()
  .then(console.log.bind(console))
