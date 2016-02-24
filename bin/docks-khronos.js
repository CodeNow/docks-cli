'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/khronos')()
  .then(console.log.bind(console))
