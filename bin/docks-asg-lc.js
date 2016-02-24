'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/asg-lc')()
  .then(console.log.bind(console))
