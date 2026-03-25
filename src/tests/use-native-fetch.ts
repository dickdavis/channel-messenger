// Restore native Response/Request/Headers for server-side tests.
// happy-dom's Response drops Set-Cookie headers which breaks
// testing route handlers that set cookies.
//
// These native references are saved in svelte-loader.ts before
// happy-dom registers its global overrides.

const nativeResponse = (globalThis as any).__nativeResponse
const nativeRequest = (globalThis as any).__nativeRequest
const nativeHeaders = (globalThis as any).__nativeHeaders

if (nativeResponse != null) {
  globalThis.Response = nativeResponse
}
if (nativeRequest != null) {
  globalThis.Request = nativeRequest
}
if (nativeHeaders != null) {
  globalThis.Headers = nativeHeaders
}
