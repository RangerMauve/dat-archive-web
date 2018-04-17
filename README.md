# dat-archive-web
DatArchive implementation for browsers that uses dat-gateway

Uses [fork of dat-gateway](https://github.com/RangerMauve/dat-gateway/tree/websocket-replication) that supports synchronization over websockets.

Based on [node-dat-archive](https://github.com/beakerbrowser/node-dat-archive)

Public gateway: `gateway.mauve.moe:3000`

## Example

```javascript
// After including the bundle in a script tag, or requiring it

const archive = new DatArchive('dat://87ed2e3b160f261a032af03921a3bd09227d0a4cde73466c17114816cae43336')

archive.readFile('/index.html')
  .then((html) => console.log(html))
```

## API

Implements the same interface as [DatArchive](https://beakerbrowser.com/docs/apis/dat.html) in Beaker with the following exceptions:

- `DatArchive.fork()`, `archive.diff()`, `archive.commit()`, and `archive.revert()` are not supported
- `DatArchive.selectArchive()` returns a new DatArchive every time
- By default requires an instance of dat-gateway running on http://localhost:3000
- Uses `DatArchive.setManager()` to set the manager which is an object with the following API:
  - `getStorage(key: String) : Promise<Storage>` : Retruns the [storage](https://www.npmjs.com/package/random-access-storage) to use with [hyperdrive](https://github.com/mafintosh/hyperdrive#var-archive--hyperdrivestorage-key-options). By default it will persist to [memory](https://www.npmjs.com/package/random-access-memory)
  - `selectArchive(options) : Promise<String>` : Returns the URL of a user selected archive. Takes same options as the [DatArchive API](https://beakerbrowser.com/docs/apis/dat.html#datarchive-selectarchive). By default it returns null to always create a new archive
  - `replicate(key: String) : Stream` : Returns a stream used to replicate the hyperdrive instance. By default it will connect to the gateway over websockets.
  - `resolveName(url: String) : Promise<String>` resolves a dat URL with a hostname to a dat URL which uses the public key
  - An implementation can be found in `DefaultManager` that can be extended to do fancier things.


## Setting a custom gateway

```javascript
const DatArchive = require('dat-archive-web')
const DefaultManager = require(`dat-archive-web/DefaultManager`)

// Use a public dat gateway so you don't need a local one
const publicGateway = 'gateway.mauve.moe:3000'
DatArchive.setManager(new DefaultManager(publicGateway))
```

# Roadmap

- [x] Initial implementation
- [x] Public gateway
- [x] Refactor to support more environments
- [ ] Detect HTTP/HTTPS in gateway URL
- [ ] Functional DatDNS support
- [ ] Persist to IndexedDB
- [ ] Forking
- [ ] UI for choosing archives

## Development

- This project uses the `standard` code style
- Run the example in node with `npm install && npm run example`
- Build the browserify bundle with `npm run build`