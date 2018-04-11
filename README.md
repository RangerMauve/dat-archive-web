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

- `DatArchive.fork()`, `DatArchive.selectArchive()`, `archive.diff()`, `archive.commit()`, and `archive.revert()` are not supported
- By default requires an instance of dat-gateway running on http://localhost:3000
- `DatArchive.setGateway()` can be used to set the URL to use for the gateway
- `gateway` can be passed into `create()` and the constructor to set the gateway for a specific instance of DatArchive
- `storage` can be passed into `create()` and the constructor which will be passed to the [hyperdrive](https://github.com/mafintosh/hyperdrive#var-archive--hyperdrivestorage-key-options) instance for storing data. By default data is stored in memory and doesn't persist.

# Roadmap

- [x] Initial implementation
- [x] Public gateway
- [ ] Persist to IndexedDB
- [ ] Forking
- [ ] UI for choosing archives

## Development

- This project uses the `standard` code style
- Run the example in node with `npm install && npm run example`
- Build the browserify bundle with `npm run build`