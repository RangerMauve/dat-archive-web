const ram = require('random-access-memory')
const Websocket = require('websocket-stream')
const fetch = require('fetch-ponyfill')().fetch
const parseDatURL = require('parse-dat-url')

const DEFAULT_PORT = 0xDA7

class DefaultManager {
  constructor (gateway) {
    const parsed = parseDatURL(gateway)
    this.port = parsed.port || DEFAULT_PORT
    this.secure = parsed.protocol === 'https:'
    this.hostname = parsed.hostname
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
    const protocol = this.secure ? 'wss:' : 'ws:'
    const proxyURL = `{${protocol}//${this.hostname}:${this.port}/${key}`

    const socket = Websocket(proxyURL)

    return socket
  }

  // Resolve a dat URL with a domain name to a dat URL with the key
  async resolveName (url) {
    const key = parseDatURL(url.replace('dat', 'http')).hostname
    const protocol = this.secure ? 'https:' : 'http:'
    const proxyURL = `${protocol}//${this.hostname}:${this.port}/${key}/.well-known/dat`

    const response = await fetch(proxyURL)

    const resolved = await response.text()

    return resolved.split('\n')[0].slice(6)
  }
}

module.exports = DefaultManager
