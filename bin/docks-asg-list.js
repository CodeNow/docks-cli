'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/asg-list')()
  .then(console.log.bind(console))
