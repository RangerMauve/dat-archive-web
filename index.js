const DatArchive = require('./DatArchive')
const DefaultManager = require('./DefaultManager')

let DEFAULT_GATEWAY = 'localhost:3000'

DatArchive.setManager(new DefaultManager(DEFAULT_GATEWAY))

module.exports = DatArchive
