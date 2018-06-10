const ram = require('random-access-memory')
const Websocket = require('websocket-stream')
const fetch = require('fetch-ponyfill')().fetch

class DefaultManager {
  // Set up the manager with an optional gateway
  // If no gateway is specified in the constructor, make sure to invoke setGateway before the first archive is loaded
  constructor (gateway) {
    // Set .loading to a promise if you need initialization before the manager can be used
    this.loading = null

    if (gateway) {
      this.setGateway(gateway)
    }
  }

  set gateway (gateway) {
    this._gateway = new window.URL(gateway)
  }

  get gateway () {
    return this._gateway.toString()
  }

  // Get a `random-access-storage` instance for a Dat key
  // `key` is the dat key for the storage
  // `secretKey` is used if this is a newly created dat. This can be used with onAddArchive to track created dats.
  getStorage (key, secretKey) {
    // Store in memory by default
    return ram
  }

  // Invoked when a new archive has been created
  async onAddArchive (key, secretKey, options) {
    // Managers should save the key to support `selectArchive`
    return null
  }

  // Get the URL of an archive to use
  async selectArchive (options) {
    // Return null to create a new instance since nothing is persisted
    return null
  }

  // Get a replication stream for a Dat key
  replicate (key) {
    const proxyURLData = new window.URL(this.gateway)

    proxyURLData.protocol = proxyURLData.protocol.replace('http', 'ws')
    proxyURLData.pathname = key

    const proxyURL = proxyURLData.toString()

    const socket = Websocket(proxyURL)

    return socket
  }

  // Resolve a dat URL with a domain name to a dat URL with the key
  async resolveName (url) {
    let key = (new window.URL(url)).hostname

    if (key.length === 64) {
      return key
    }

    var proxyURL = new window.URL(this.gateway)
    proxyURL.pathname = `${key}/.well-known/dat`

    const response = await fetch(proxyURL.toString())

    const resolved = await response.text()

    // The first line should be a `dat://` url, take the key from it
    key = resolved.split('\n')[0].slice(6)

    return key
  }
}

module.exports = DefaultManager
