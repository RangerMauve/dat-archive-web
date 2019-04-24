# dat-archive-web
DatArchive implementation for browsers using [dat-js](https://github.com/datproject/dat-js#readme)

```
npm install --save dat-archive-web
```

Or

```html
<script src="//unpkg.com/dat-archive-web/bundle.js"></script>
```

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
- `DatArchive.selectArchive()` doesn't do filtering and looks crappy. Uses [window.prompt](https://developer.mozilla.org/en-US/docs/Web/API/Window/prompt) API
- `DatArchive.resolveName()` doesn't work and DNS based urls aren't supported. Waiting for dat-js support

# Features

- [x] Support most DatArchive methods
- [x] Public bridges used to replicate with non-browser network
- [x] Detect HTTP/HTTPS in gateway URL
- [x] Data stored in memory by default, unless it was created locally.
- [] Functional DatDNS support (via gateway)
- [x] Full support for versions (Needs testing, but code is there)
- [x] Forking (without preserving change feed)
- [x] DatArchive.selectArchive() Really rudimentary

## Development

- This project uses the `standard` code style
- Run the example in node with `npm install && npm run example`
- Build the browserify bundle with `npm run build`
