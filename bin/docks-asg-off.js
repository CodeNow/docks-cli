'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/asg-off')()
  .then(console.log.bind(console))
