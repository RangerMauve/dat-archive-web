// Ripped out of node-dat-archive

const path = require('path')
const pda = require('pauls-dat-api')
const parseDatURL = require('parse-dat-url')
const concat = require('concat-stream')
const pump = require('pump')
const { timer, toEventTarget } = require('node-dat-archive/lib/util')
const {
  DAT_MANIFEST_FILENAME,
  DAT_VALID_PATH_REGEX,
  DEFAULT_DAT_API_TIMEOUT
} = require('node-dat-archive/lib/const')
const {
  ArchiveNotWritableError,
  ProtectedFileNotWritableError,
  InvalidPathError
} = require('beaker-error-constants')
const hyperdrive = require('hyperdrive')
const crypto = require('hypercore/lib/crypto')

const REPLICATION_DELAY = 3000

const to = (opts) =>
  (opts && typeof opts.timeout !== 'undefined')
    ? opts.timeout
    : DEFAULT_DAT_API_TIMEOUT

class DatArchive {
  static setManager (manager) {
    DatArchive._manager = manager
  }

  constructor (url) {
    let version = null
    let key = null

    const options = {
      sparse: true
    }

    if (url) {
      const urlp = parseDatURL(url)
      version = urlp.version
      key = urlp.hostname || urlp.pathname.slice(2).slice(0, 64)
    } else {
      const keypair = crypto.keyPair()
      key = keypair.publicKey
      options.secretKey = keypair.secretKey
    }

    const storage = DatArchive._manager.getStorage(key.toString('hex'))

    const archive = hyperdrive(storage, key, options)

    this._archive = archive

    this._loadPromise = waitReady(archive).then(async () => {
      this._checkout = version ? archive.checkout(version) : archive
      this.url = this.url || `dat://${archive.key.toString('hex')}`

      const stream = this._replicate()

      await waitOpen(stream)

      if (url) {
        await waitReplication()
      }
    })
  }

  _replicate () {
    const archive = this._archive
    const key = archive.key.toString('hex')
    const stream = DatArchive._manager.replicate(key)

    pump(stream, archive.replicate({
      live: true,
      upload: true
    }), stream, (err) => {
      console.error(err)

      this._replicate()
    })

    this._stream = stream

    return stream
  }

  async getInfo (url, opts = {}) {
    return timer(to(opts), async () => {
      await this._loadPromise

      // read manifest
      var manifest
      try {
        manifest = await pda.readManifest(this._checkout)
      } catch (e) {
        manifest = {}
      }

      // return
      return {
        key: this._archive.key.toString('hex'),
        url: this.url,
        isOwner: this._archive.writable,

        // state
        version: this._checkout.version,
        peers: this._archive.metadata.peers.length,
        mtime: 0,
        size: 0,

        // manifest
        title: manifest.title,
        description: manifest.description,
        type: manifest.type,
        author: manifest.author
      }
    })
  }

  async diff () {
    // noop
    return []
  }

  async commit () {
    // noop
    return []
  }

  async revert () {
    // noop
    return []
  }

  async history (opts = {}) {
    return timer(to(opts), async () => {
      await this._loadPromise
      var reverse = opts.reverse === true
      var { start, end } = opts

      // if reversing the output, modify start/end
      start = start || 0
      end = end || this._checkout.metadata.length
      if (reverse) {
        // swap values
        let t = start
        start = end
        end = t
        // start from the end
        start = this._checkout.metadata.length - start
        end = this._checkout.metadata.length - end
      }

      return new Promise((resolve, reject) => {
        var stream = this._checkout.history({ live: false, start, end })
        stream.pipe(concat({ encoding: 'object' }, values => {
          values = values.map(massageHistoryObj)
          if (reverse) values.reverse()
          resolve(values)
        }))
        stream.on('error', reject)
      })
    })
  }

  async stat (filepath, opts = {}) {
    filepath = massageFilepath(filepath)
    return timer(to(opts), async () => {
      await this._loadPromise
      return pda.stat(this._checkout, filepath)
    })
  }

  async readFile (filepath, opts = {}) {
    filepath = massageFilepath(filepath)
    return timer(to(opts), async () => {
      await this._loadPromise
      return pda.readFile(this._checkout, filepath, opts)
    })
  }

  async writeFile (filepath, data, opts = {}) {
    filepath = massageFilepath(filepath)
    return timer(to(opts), async () => {
      await this._loadPromise
      if (this._version) throw new ArchiveNotWritableError('Cannot modify a historic version')
      await assertWritePermission(this._archive)
      await assertValidFilePath(filepath)
      await assertUnprotectedFilePath(filepath)
      return pda.writeFile(this._archive, filepath, data, opts)
    })
  }

  async unlink (filepath) {
    filepath = massageFilepath(filepath)
    return timer(to(), async () => {
      await this._loadPromise
      if (this._version) throw new ArchiveNotWritableError('Cannot modify a historic version')
      await assertWritePermission(this._archive)
      await assertUnprotectedFilePath(filepath)
      return pda.unlink(this._archive, filepath)
    })
  }

  async download (filepath, opts = {}) {
    filepath = massageFilepath(filepath)
    return timer(to(opts), async (checkin) => {
      await this._loadPromise
      if (this._version) throw new Error('Not yet supported: can\'t download() old versions yet. Sorry!') // TODO
      if (this._archive.writable) {
        return // no need to download
      }
      return pda.download(this._archive, filepath)
    })
  }

  async readdir (filepath, opts = {}) {
    filepath = massageFilepath(filepath)
    return timer(to(opts), async () => {
      await this._loadPromise
      var names = await pda.readdir(this._checkout, filepath, opts)
      if (opts.stat) {
        for (let i = 0; i < names.length; i++) {
          names[i] = {
            name: names[i],
            stat: await pda.stat(this._checkout, path.join(filepath, names[i]))
          }
        }
      }
      return names
    })
  }

  async mkdir (filepath) {
    filepath = massageFilepath(filepath)
    return timer(to(), async () => {
      await this._loadPromise
      if (this._version) throw new ArchiveNotWritableError('Cannot modify a historic version')
      await assertWritePermission(this._archive)
      await assertValidPath(filepath)
      await assertUnprotectedFilePath(filepath)
      return pda.mkdir(this._archive, filepath)
    })
  }

  async rmdir (filepath, opts = {}) {
    return timer(to(opts), async () => {
      filepath = massageFilepath(filepath)
      await this._loadPromise
      if (this._version) throw new ArchiveNotWritableError('Cannot modify a historic version')
      await assertUnprotectedFilePath(filepath)
      return pda.rmdir(this._archive, filepath, opts)
    })
  }

  createFileActivityStream (pathPattern) {
    return toEventTarget(pda.createFileActivityStream(this._archive, pathPattern))
  }

  createNetworkActivityStream () {
    return toEventTarget(pda.createNetworkActivityStream(this._archive))
  }

  static async resolveName (name) {
    return DatArchive._manager.resolveName(name)
  }

  static async fork () {
    throw new TypeError('Not supported')
  }

  static async selectArchive (options) {
    const url = await DatArchive._manager.selectArchive(options)

    const archive = new DatArchive(url)

    await archive._loadPromise

    return archive
  }

  static async create ({ title, description, type, author }) {
    const archive = new DatArchive(null)

    await archive._loadPromise

    await pda.writeManifest(archive._archive, { url: archive.url, title, description, type, author })

    return archive
  }
}

module.exports = DatArchive

// helper to check if filepath refers to a file that userland is not allowed to edit directly
function assertUnprotectedFilePath (filepath) {
  if (filepath === '/' + DAT_MANIFEST_FILENAME) {
    throw new ProtectedFileNotWritableError()
  }
}

async function assertWritePermission (archive) {
  // ensure we have the archive's private key
  if (!archive.writable) {
    throw new ArchiveNotWritableError()
  }
  return true
}

async function assertValidFilePath (filepath) {
  if (filepath.slice(-1) === '/') {
    throw new InvalidPathError('Files can not have a trailing slash')
  }
  await assertValidPath(filepath)
}

async function assertValidPath (fileOrFolderPath) {
  if (!DAT_VALID_PATH_REGEX.test(fileOrFolderPath)) {
    throw new InvalidPathError('Path contains invalid characters')
  }
}

function massageHistoryObj ({ name, version, type }) {
  return { path: name, version, type }
}

function massageFilepath (filepath) {
  filepath = filepath || ''
  filepath = decodeURIComponent(filepath)
  if (!filepath.startsWith('/')) {
    filepath = '/' + filepath
  }
  return filepath
}

function waitReady (archive) {
  return new Promise((resolve, reject) => {
    archive.once('ready', resolve)
    archive.once('error', reject)
  })
}

function waitOpen (stream) {
  return new Promise(function (resolve, reject) {
    stream.once('data', onData)
    stream.once('error', onError)

    function onData () {
      stream.removeListener('error', onError)
      resolve(stream)
    }

    function onError (e) {
      stream.removeListener('data', onData)
      reject(e)
    }
  })
}

function waitReplication () {
  return new Promise((resolve) => {
    setTimeout(resolve, REPLICATION_DELAY)
  })
}
