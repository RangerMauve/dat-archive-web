const DatArchive = require('./DatArchive')
const DefaultManager = require('./DefaultManager')
const idb = require('random-access-idb')

class PersistantManager extends DefaultManager {
  constructor () {
    super('http://gateway.mauve.moe:3000')
  }

  getStorage (key) {
    return idb(`dat://${key}/`)
  }
}

// Only patch global if it doesn't exist
// Makes this a polyfill!
if (!window.DatArchive) {
  DatArchive.setManager(new PersistantManager())
  window.DatArchive = DatArchive
}
