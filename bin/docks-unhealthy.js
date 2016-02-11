'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/unhealthy')()
  .then(console.log.bind(console))
