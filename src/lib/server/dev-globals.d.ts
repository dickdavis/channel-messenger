// Global variables shared between the Vite plugin (Node.js) and SvelteKit SSR during dev.
// The Vite plugin sets these in configureServer; SvelteKit route handlers read them.
// Using a standalone .d.ts so both contexts share the same type declaration.

declare global {
  // eslint-disable-next-line no-var
  var devSessionBroadcast: ((sessionId: string, message: unknown) => void) | undefined
  // eslint-disable-next-line no-var
  var devPlatformEnv: { DB: D1Database, HMAC_SECRET: string, VAPID_PUBLIC_KEY: string, VAPID_PRIVATE_KEY: string, VAPID_SUBJECT: string, [key: string]: unknown } | undefined
}

export {}
