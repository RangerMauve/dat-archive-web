const ram = require('random-access-memory')
const Websocket = require('websocket-stream')
const fetch = require('fetch-ponyfill')().fetch
const parseURL = require('url-parse')

const DEFAULT_PORT = 0xDA7

class DefaultManager {
  constructor (gateway) {
    const parsed = parseURL(gateway)
    this.port = parsed.port || DEFAULT_PORT
    this.secure = parsed.protocol === 'https:'
    this.hostname = parsed.hostname
  }

  // Get a `random-access-storage` instance for a Dat key
  getStorage (key) {
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
    const protocol = this.secure ? 'wss:' : 'ws:'
    const proxyURL = `${protocol}//${this.hostname}:${this.port}/${key}`

    const socket = Websocket(proxyURL)

    return socket
  }

  // Resolve a dat URL with a domain name to a dat URL with the key
  async resolveName (url) {
    const domain = parseURL(url).hostname

    if (domain.length === 64) {
      return domain
    }

    const protocol = this.secure ? 'https:' : 'http:'
    const proxyURL = `${protocol}//${this.hostname}:${this.port}/${domain}/.well-known/dat`

    const response = await fetch(proxyURL)

    const resolved = await response.text()

    const key = resolved.split('\n')[0].slice(6)

    return key
  }
}

module.exports = DefaultManager
