const ram = require('random-access-memory')
const Websocket = require('websocket-stream')
const fetch = require('fetch-ponyfill').fetch

class DefaultManager {
  constructor (gateway) {
    this.gateway = gateway
  }

  // Get a `random-access-storage` instance for a Dat key
  getStorage (key) {
    // Store in memory by default
    return ram
  }

  // Get the URL of an archive to use
  async selectArchive (options) {
    // Return null to create a new instance since nothing is persisted
    return null
  }

  // Get a replication stream for a Dat key
  replicate (key) {
    const proxyURL = `ws://${this.gateway}/${key}`

    const socket = Websocket(proxyURL)

    return socket
  }

  // Resolve a dat URL with a domain name to a dat URL with the key
  async resolveName (url) {
    const key = url.repace('dat://', '')
    const proxyURL = `http://${this.gateway}/${key}/.well_known/dat`

    const response = await fetch(proxyURL)

    const resolved = await response.text()

    return resolved.split('\n')[0]
  }
}

module.exports = DefaultManager
