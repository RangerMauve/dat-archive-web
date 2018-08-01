// Ripped out of node-dat-archive

const path = require('path')
const pda = require('pauls-dat-api')
const parseURL = require('url-parse')
const concat = require('concat-stream')
const pump = require('pump')
const { timer, toEventTarget } = require('node-dat-archive/lib/util')
const {
  DAT_MANIFEST_FILENAME,
  DAT_VALID_PATH_REGEX
} = require('node-dat-archive/lib/const')
const {
  ArchiveNotWritableError,
  ProtectedFileNotWritableError,
  InvalidPathError
} = require('beaker-error-constants')
const hyperdrive = require('hyperdrive')
const crypto = require('hypercore/lib/crypto')
const hexTo32 = require('hex-to-32')

// Gateways are hella slow so we'll have a crazy long timeout
const API_TIMEOUT = 15 * 1000

const BASE_32_KEY_LENGTH = 52

const to = (opts) =>
  (opts && typeof opts.timeout !== 'undefined')
    ? opts.timeout
    : API_TIMEOUT

class DatArchive {
  static setManager (manager) {
    DatArchive._manager = manager
  }

  constructor (url) {
    let version = null
    let key = null
    let secretKey = null

    this.url = url

    this._loadPromise = getURLData(url).then(async (urlData) => {
      const options = {
        sparse: true
      }

      if (urlData.key) {
        key = urlData.key
        version = urlData.version
      } else {
        const keypair = crypto.keyPair()
        key = keypair.publicKey
        secretKey = keypair.secretKey
        options.secretKey = secretKey
      }

      const storage = DatArchive._manager.getStorage(key.toString('hex'), secretKey && secretKey.toString('hex'))

      const archive = hyperdrive(storage, key, options)

      this._archive = archive

      await waitReady(archive)

      this._checkout = version ? archive.checkout(version) : archive
      this.url = this.url || `dat://${archive.key.toString('hex')}`

      const stream = this._replicate()

      await waitOpen(stream)

      if (!archive.writable && !archive.metadata.length) {
        // wait to receive a first update
        await new Promise((resolve, reject) => {
          archive.metadata.update(err => {
            if (err) reject(err)
            else resolve()
          })
        })
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
    return toEventTarget(pda.watch(this._archive, pathPattern))
  }

  createNetworkActivityStream () {
    return toEventTarget(pda.createNetworkActivityStream(this._archive))
  }

  static async resolveName (name) {
    return DatArchive._manager.resolveName(name)
  }

  static async fork (url, opts) {
    const srcDat = new DatArchive(url)

    const destDat = await DatArchive.create(opts)

    await srcDat._loadPromise

    await pda.exportArchiveToArchive({
      srcArchive: srcDat._archive,
      dstArchive: destDat._archive
    })

    return destDat
  }

  static async selectArchive (options) {
    const url = await DatArchive._manager.selectArchive(options)

    const archive = new DatArchive(url)

    await archive._loadPromise

    return archive
  }

  static async create ({ title, description, type, author } = {}) {
    const archive = new DatArchive(null)

    await archive._loadPromise

    await pda.writeManifest(archive._archive, { url: archive.url, title, description, type, author })

    await DatArchive._manager.onAddArchive(
      archive._archive.key.toString('hex'),
      archive._archive.metadata.secretKey.toString('hex'),
      {title, description, type, author}
    )

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

async function getURLData (url) {
  let key = null
  let version = null

  if (url) {
    const parsed = parseURL(url)
    let hostname = null
    const isDat = parsed.protocol.indexOf('dat') === 0
    const isUndefined = parsed.protocol.indexOf('undefined') === 0
    if (isDat || isUndefined) {
      const hostnameParts = parsed.hostname.split('+')
      hostname = hostnameParts[0]
      version = hostnameParts[1] || null
    } else {
      const hostnameParts = parsed.hostname.split('.')
      const subdomain = hostnameParts[0]
      if (subdomain.length === BASE_32_KEY_LENGTH) {
        hostname = hexTo32.decode(subdomain)
      } else {
        hostname = parsed.hostname
      }
    }
    key = await DatArchive._manager.resolveName(`dat://${hostname}`)
  }

  return {
    key: key,
    version: version
  }
}
