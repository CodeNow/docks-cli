'use strict'

require('../lib/util/unhandled-catcher')()

require('../lib/actions/asg-delete')()
  .then(console.log.bind(console))
