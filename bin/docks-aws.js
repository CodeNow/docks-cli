'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/aws')()
  .then(console.log.bind(console))
