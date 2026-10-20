/**
 * jsdom deliberately ships no fetch stack, but React Router's data router
 * builds a `Request` for every navigation, and our stream code will use
 * `AbortController`. Node has all of these; jsdom just hides them.
 *
 * This environment copies the missing globals from Node's realm into the
 * jsdom one. The alternative is a polyfill dependency (undici), which would
 * add a package to test a browser API Node already implements.
 *
 * CommonJS on purpose: Jest loads the environment itself, before any
 * TypeScript or ESM transform is in play.
 */
const JSDOMEnvironment = require('jest-environment-jsdom').default

const MISSING_IN_JSDOM = [
  'fetch',
  'Request',
  'Response',
  'Headers',
  'FormData',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'TextEncoder',
  'TextDecoder',
  'AbortController',
  'AbortSignal',
  'structuredClone',
  'BroadcastChannel',
]

module.exports = class PendantTestEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context)

    for (const name of MISSING_IN_JSDOM) {
      if (this.global[name] === undefined && globalThis[name] !== undefined) {
        this.global[name] = globalThis[name]
      }
    }
  }
}
