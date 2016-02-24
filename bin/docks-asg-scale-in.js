'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/asg-scale-in')()
  .then(console.log.bind(console))
