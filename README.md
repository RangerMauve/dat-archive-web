# dat-archive-web
DatArchive implementation for browsers that uses dat-gateway

Uses [a fork of dat-gateway](https://github.com/RangerMauve/dat-gateway) that supports synchronization over websockets.

Based on [node-dat-archive](https://github.com/beakerbrowser/node-dat-archive)

Public gateway: `gateway.mauve.moe:3000`

```
npm install --save dat-archive-web
```

Check out [dat-polyfill](https://github.com/RangerMauve/dat-polyfill) if you want to set up the DatArchive API automaically.

## Example

```javascript
// After including the bundle in a script tag, or requiring it

const archive = new DatArchive('dat://87ed2e3b160f261a032af03921a3bd09227d0a4cde73466c17114816cae43336')

archive.readFile('/index.html')
  .then((html) => console.log(html))
```

## API

Implements the same interface as [DatArchive](https://beakerbrowser.com/docs/apis/dat.html) in Beaker with the following exceptions:

- `archive.diff()`, `archive.commit()`, and `archive.revert()` are not supported
- `DatArchive.selectArchive()` returns a new DatArchive every time (You can implement better behavior in the Manager)
- By default requires an instance of dat-gateway running on http://localhost:3000
- Uses `DatArchive.setManager()` to set the manager which is an object with the following API:
  - `getStorage(key: String) : Promise<Storage>` : Retruns the [storage](https://www.npmjs.com/package/random-access-storage) to use with [hyperdrive](https://github.com/mafintosh/hyperdrive#var-archive--hyperdrivestorage-key-options). By default it will persist to [memory](https://www.npmjs.com/package/random-access-memory)
  - `selectArchive(options) : Promise<String>` : Returns the URL of a user selected archive. Takes same options as the [DatArchive API](https://beakerbrowser.com/docs/apis/dat.html#datarchive-selectarchive). By default it returns null to always create a new archive
  - `replicate(key: String) : Stream` : Returns a stream used to replicate the hyperdrive instance. By default it will connect to the gateway over websockets.
  - `resolveName(url: String) : Promise<String>` resolves a dat URL with a hostname to a dat URL which uses the public key
  - `onAddArchive(key: String, secretKey: String, options: Object) : Promise<void>` invoked whenever `DatArchive.create()` is invoked. Allows managers to save the dat information to be used in `selectArchive()`
  - `gateway` is a property used for getting/setting the gateway URL at runtime
  - An implementation can be found in `DefaultManager` that can be extended to do fancier things.
  - Can also be used by extending from `DatArchive.DefaultManager`

## Setting a custom gateway

```javascript
const DatArchive = require('dat-archive-web')
const DefaultManager = DatArchive.DefaultManager

// Use a public dat gateway so you don't need a local one
const publicGateway = 'gateway.mauve.moe:3000'
DatArchive.setManager(new DefaultManager(publicGateway))
```

# Features

- [x] Support most DatArchvie methods
- [x] Public [gateway](https://github.com/RangerMauve/dat-gateway) at http://gateway.mauve.moe:3000/ 
- [x] Extensiblity for different environments
- [x] Detect HTTP/HTTPS in gateway URL
- [x] Functional DatDNS support (via gateway)
- [x] Data stored in memory by default
- [x] Can persist to IndexedDB (via random-access-idb)
- [x] Full support for versions (Needs testing, but code is there)
- [x] Forking (without preserving change feed)
- [x] DatArchive.selectArchive() (function offloaded to Manager)

## Development

- This project uses the `standard` code style
- Run the example in node with `npm install && npm run example`
- Build the browserify bundle with `npm run build`