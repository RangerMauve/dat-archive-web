const parseDatURL = require('parse-dat-url')
const ram = require('random-access-memory')
const Websocket = require('websocket-stream')
const hyperdrive = require('hyperdrive')
const pda = require('pauls-dat-api')

const DatArchive = require('./DatArchive')

const DEFAULT_GATEWAY = 'localhost:3000'

class DatArchiveWeb extends DatArchive {
  constructor (url, { storage = ram, gateway = DEFAULT_GATEWAY } = {}) {
    const loadPromise = open(url, gateway, storage)
      .then(async ({ archive, socket, version }) => {
        this._chekout = version ? archive.checkout(version) : archive

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
    var archive = new DatArchive(null, { storage, gateway })

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
}

module.exports = DatArchiveWeb

async function open (name, gateway, storage) {
  let archive = null
  let version = null

  if (name) {
    const url = await DatArchive.resolveName(name)
    const urlp = parseDatURL(url)
    version = urlp.version
    archive = hyperdrive(ram, urlp.hostname)
  } else {
    archive = hyperdrive(ram)
  }

  // Persist to indexDB cache in the future?

  const socket = Websocket(`ws://${gateway}/${archive.key}`)

  socket.pipe(archive.replicate()).pipe(socket)

  return {
    archive,
    socket,
    version
  }
}
