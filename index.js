const parseDatURL = require('parse-dat-url')
const ram = require('random-access-memory')
const Websocket = require('websocket-stream')
const hyperdrive = require('hyperdrive')
const pda = require('pauls-dat-api')

const DatArchive = require('./DatArchive')

let DEFAULT_GATEWAY = 'localhost:3000'

class DatArchiveWeb extends DatArchive {
  constructor (url, { storage = ram, gateway = DEFAULT_GATEWAY } = {}) {
    const loadPromise = open(url, gateway, storage)
      .then(async ({ archive, socket, version }) => {
        this._checkout = version ? archive.checkout(version) : archive

        this._version = version
        this._socket = socket
        return archive
      })
    super(loadPromise)
  }
  async _close () {
    super.close()
    this._socket.end()
  }

  static async create ({ storage = ram, gateway = DEFAULT_GATEWAY, title, description, type, author }) {
    var archive = new DatArchiveWeb(null, { storage, gateway })

    await archive._loadPromise
    await pda.writeManifest(archive._archive, { url: archive.url, title, description, type, author })

    return archive
  }

  static async fork () {
    throw new TypeError('Not supported')
  }

  static async selectArchive () {
    throw new TypeError('Not supported')
  }

  static setGateway (gateway) {
    DEFAULT_GATEWAY = gateway
  }
}

module.exports = DatArchiveWeb

async function open (name, gateway, storage) {
  let archive = null
  let version = null

  if (name) {
    const url = await DatArchiveWeb.resolveName(name)
    const urlp = parseDatURL(url)
    version = urlp.version
    archive = hyperdrive(ram, urlp.hostname)
  } else {
    archive = hyperdrive(ram)
  }

  // Persist to indexDB cache in the future?

  await waitReady(archive)

  const key = archive.key.toString('hex')

  const proxyURL = `ws://${gateway}/${key}`

  const socket = Websocket(proxyURL)

  socket.pipe(archive.replicate({
    live: true,
    upload: true
  })).pipe(socket)

  await waitOpen(socket)

  return {
    archive,
    socket,
    version
  }
}

function waitReady (archive) {
  return new Promise((resolve, reject) => {
    archive.once('ready', resolve)
    archive.once('error', reject)
  })
}

function waitOpen (socket) {
  return new Promise(function (resolve, reject) {
    socket.once('data', resolve)
    socket.once('error', reject)
  })
}
