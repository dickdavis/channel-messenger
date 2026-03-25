import { plugin } from 'bun'
import { compile, compileModule } from 'svelte/compiler'
import { readFileSync } from 'fs'
import { afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

// Save native globals before happy-dom overrides them.
// happy-dom's Response drops Set-Cookie headers, so server-side tests
// need the native implementations.
;(globalThis as any).__nativeResponse = globalThis.Response
;(globalThis as any).__nativeRequest = globalThis.Request
;(globalThis as any).__nativeHeaders = globalThis.Headers

// Register happy-dom globally before any modules load
// so that browser globals (window, document) exist at import time
await GlobalRegistrator.register()

afterEach(() => {
  document.body.innerHTML = ''
})

plugin({
  name: 'svelte loader',
  setup (builder) {
    builder.onLoad({ filter: /\.svelte$/ }, ({ path }) => {
      const source = readFileSync(path, 'utf-8')

      const result = compile(source, {
        filename: path,
        generate: 'client',
        dev: true,
        runes: true
      })

      return {
        contents: result.js.code,
        loader: 'js'
      }
    })

    builder.onLoad({ filter: /\.svelte\.[jt]s$/ }, ({ path }) => {
      const source = readFileSync(path, 'utf-8')
      const result = compileModule(source, {
        filename: path,
        dev: true
      })
      return {
        contents: result.js.code,
        loader: 'js'
      }
    })
  }
})
