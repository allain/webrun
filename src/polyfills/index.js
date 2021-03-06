const vm = require('vm')
const { URLSearchParams } = require('url')
const os = require('os')
const sep = require('path').sep

const fetch = require('node-fetch')
const FormData = require('form-data')
const Websocket = require('ws')

const { bota, atob } = require('abab')
const { TextEncoder, TextDecoder } = require('text-encoder')

const { LocalStorage } = require('node-localstorage')

const EventTarget = require('event-target').default

const urlToPath = require('../lib/url-to-path')

const makeDatArchive = require('./makeDatArchive')
const makeCrypto = require('./makeCrypto')
const makeImport = require('./import')
const prepareDir = require('../lib/prepare-dir')

var _require = require

const baseURL = new URL('file://')
baseURL.pathname = `${process.cwd()}/`

module.exports = function (dat, loadModule, LOCALSTORAGECACHE) {
  const localStorage = new LocalStorage(LOCALSTORAGECACHE)

  const sessionId = process.ppid
  const SESSIONSTORAGEPATH = new URL(`file://${os.tmpdir()}${sep}.webrun${sep}/session-${sessionId}`)
  prepareDir(SESSIONSTORAGEPATH)
  const sessionStorage = new LocalStorage(urlToPath(SESSIONSTORAGEPATH))

  const crypto = makeCrypto()
  const DatArchive = makeDatArchive(dat)
  const relativeImport = makeImport(loadModule)
  const _import = (path) => {
    return relativeImport(path, baseURL)
  }

  const contextVars = new EventTarget()

  Object.assign(contextVars, {
    // Some expected builtins
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    EventTarget,
    URL,

    // Text manipluation
    bota,
    atob,
    TextEncoder,
    TextDecoder,

    // Encryption
    crypto,

    // Networking
    fetch,
    FormData,
    URLSearchParams,
    Websocket,

    // Storage / Caching
    localStorage,
    sessionStorage,

    // STDOUT / Process stuff
    postMesage,
    close,
    argv: process.argv,

    // p2p
    DatArchive,

    // Node support
    require,

    // Add import
    _import
  });

  ['window', 'global', 'self'].forEach((name) => {
    Object.defineProperty(contextVars, name, {
      get: function () {
        return this
      }
    })
  })

  process.stdin.on('data', (data) => {
    const event = {
      data,
      type: 'message'
    }
    contextVars.dispatchEvent(event)
    if (typeof contextVars.onmessage === 'function') {
      contextVars.onmessage(event)
    }
  })

  const context = vm.createContext(contextVars, {
    name: 'WebRun'
  })

  return context

  function postMesage (message) {
    process.stdout.write(message)
  }

  function close (statusCode) {
    process.exit(statusCode || 0)
  }

  function require (path) {
    if (/^[.\\/]/.test(path)) {
      const finalPath = urlToPath(new URL(path, baseURL))
      return _require(finalPath)
    } else {
      return _require(path)
    }
  }
}