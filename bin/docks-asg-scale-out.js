'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/asg-scale-out')()
  .then(console.log.bind(console))
