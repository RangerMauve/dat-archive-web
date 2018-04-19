const DatArchive = require('./DatArchive')
const DefaultManager = require('./DefaultManager')

let DEFAULT_GATEWAY = 'http://localhost:3000'

DatArchive.setManager(new DefaultManager(DEFAULT_GATEWAY))

module.exports = DatArchive
