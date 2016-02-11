'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/asg-create')()
  .then(console.log.bind(console))
