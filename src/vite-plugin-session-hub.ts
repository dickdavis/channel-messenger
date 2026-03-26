import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import type { Plugin, ViteDevServer } from 'vite'
import { WebSocketServer, type WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Duplex } from 'stream'

const WS_ROUTE = /^\/api\/ws\/sessions\/(\d+)/

/// <reference path="./lib/server/dev-globals.d.ts" />

export function sessionHub (): Plugin {
  let root = ''

  return {
    name: 'session-hub',

    configResolved (config) {
      root = config.root
    },

    configureServer (server: ViteDevServer) {
      const wss = new WebSocketServer({ noServer: true })
      const sessions = new Map<string, Set<WebSocket>>()

      // Wait for the adapter's platform env to be shared via hooks.server.ts
      async function getPlatformEnv (): Promise<{ DB: D1Database, HMAC_SECRET: string, VAPID_PUBLIC_KEY: string, VAPID_PRIVATE_KEY: string, VAPID_SUBJECT: string, [key: string]: unknown }> {
        // The adapter's getPlatformProxy() makes env available on first request.
        // Poll briefly — the WebSocket auth message arrives after the session
        // creation HTTP request, so the env should already be set.
        for (let i = 0; i < 50; i++) {
          if (globalThis.devPlatformEnv != null) return globalThis.devPlatformEnv
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        throw new Error('Platform env not available — has the server handled an HTTP request yet?')
      }

      async function verifyOwnership (db: D1Database, sessionId: string, userId: number): Promise<boolean> {
        const row = await db
          .prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?')
          .bind(sessionId, userId)
          .first()
        return row != null
      }

      server.httpServer?.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const match = req.url?.match(WS_ROUTE)
        if (match == null) return // Let Vite handle HMR upgrades

        const sessionId = match[1]

        wss.handleUpgrade(req, socket, head, (ws) => {
          let authenticated = false
          let authType: 'cookie' | 'token' | null = null

          const timeout = setTimeout(() => {
            if (!authenticated) {
              ws.send(JSON.stringify({ type: 'error', message: 'Authentication timeout' }))
              ws.close(4001, 'Authentication timeout')
            }
          }, 5000)

          function markAuthenticated (): void {
            clearTimeout(timeout)
            authenticated = true
            const set = sessions.get(sessionId) ?? new Set()
            sessions.set(sessionId, set)
            set.add(ws)
            ws.send(JSON.stringify({ type: 'auth', status: 'ok' }))
          }

          // Try cookie auth first (browser clients).
          // Token auth messages wait for this to settle to avoid races.
          const cookieAuthDone = (async () => {
            try {
              const cookieHeader = req.headers.cookie ?? null
              if (cookieHeader == null) return

              const env = await getPlatformEnv()
              const { verifySession } = await import('./lib/session')
              const user = await verifySession(env.HMAC_SECRET, cookieHeader)

              if (user == null) return

              const owns = await verifyOwnership(env.DB, sessionId, user.id)
              if (owns) {
                authType = 'cookie'
                markAuthenticated()
              } else {
                // Valid cookie but wrong session — reject immediately
                clearTimeout(timeout)
                ws.send(JSON.stringify({ type: 'error', message: 'Forbidden' }))
                ws.close(4003, 'Forbidden')
              }
            } catch (err) {
              console.error('[session-hub] Cookie auth error:', err)
            }
          })()

          // Handle incoming messages (auth + content)
          const onMessage = (data: Buffer | string): void => {
            void (async () => {
              let parsed: { type: string, token?: string, content?: string }
              try {
                parsed = JSON.parse(String(data))
              } catch {
                return
              }

              // Auth message
              if (parsed.type === 'auth' && typeof parsed.token === 'string') {
                // Wait for cookie auth to settle before attempting token auth
                await cookieAuthDone
                if (authenticated) return

                try {
                  const env = await getPlatformEnv()
                  const { verifyToken } = await import('./lib/auth')
                  const result = await verifyToken(env.DB, env.HMAC_SECRET, parsed.token)

                  if (result == null) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }))
                    ws.close(4003, 'Invalid token')
                    return
                  }

                  const owns = await verifyOwnership(env.DB, sessionId, result.userId)
                  if (!owns) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Forbidden' }))
                    ws.close(4003, 'Forbidden')
                    return
                  }

                  authType = 'token'
                  markAuthenticated()
                } catch (err) {
                  console.error('[session-hub] Auth error:', err)
                  ws.send(JSON.stringify({ type: 'error', message: 'Internal error' }))
                  ws.close(1011, 'Internal error')
                }
                return
              }

              // Content message
              if (parsed.type === 'message' && typeof parsed.content === 'string' && parsed.content !== '') {
                if (!authenticated) {
                  ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }))
                  return
                }

                try {
                  const role = authType === 'cookie' ? 'user' : 'assistant'
                  const env = await getPlatformEnv()
                  const result = await env.DB
                    .prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)')
                    .bind(sessionId, role, parsed.content)
                    .run()

                  await env.DB
                    .prepare("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?")
                    .bind(sessionId)
                    .run()

                  const message = {
                    id: result.meta.last_row_id,
                    session_id: Number(sessionId),
                    role,
                    content: parsed.content,
                    created_at: new Date().toISOString()
                  }

                  // Broadcast to all connected clients for this session
                  const payload = JSON.stringify({ type: 'message', message })
                  const sockets = sessions.get(sessionId)
                  if (sockets != null) {
                    for (const client of sockets) {
                      client.send(payload)
                    }
                  }

                  // Send push notifications
                  const { sendPushForSession } = await import('./lib/server/push-notify')
                  if (env.VAPID_PUBLIC_KEY !== '' && env.VAPID_PRIVATE_KEY !== '' && env.VAPID_SUBJECT !== '') {
                    void sendPushForSession(env.DB, env, sessionId, message)
                  }
                } catch (err) {
                  console.error('[session-hub] Message handling error:', err)
                  ws.send(JSON.stringify({ type: 'error', message: 'Failed to send message' }))
                }
              }
            })()
          }

          ws.on('message', onMessage)

          ws.on('close', () => {
            clearTimeout(timeout)
            sessions.get(sessionId)?.delete(ws)
          })
        })
      })

      // Expose broadcast for route handlers in dev
      globalThis.devSessionBroadcast = (sessionId: string, message: unknown) => {
        const sockets = sessions.get(sessionId)
        if (sockets == null) return
        const payload = JSON.stringify({ type: 'message', message })
        for (const ws of sockets) {
          ws.send(payload)
        }
      }
    },

    async closeBundle () {
      const cfDir = join(root, '.svelte-kit', 'cloudflare')
      const workerPath = join(cfDir, '_worker.js')
      const sveltekitPath = join(cfDir, '_worker.sveltekit.js')
      const hubSrcPath = join(root, 'src', 'lib', 'server', 'session-hub.ts')

      if (!existsSync(workerPath)) return

      // Check for idempotency marker
      const workerContent = readFileSync(workerPath, 'utf-8')
      if (workerContent.includes('// SESSION_HUB_EXPORT')) return

      // Bundle the Durable Object class via bun build (closeBundle runs in Vite/Rolldown, not Bun)
      const outfile = join(cfDir, '_session-hub.js')
      try {
        execSync(`bun build ${hubSrcPath} --outfile ${outfile} --target=browser --format=esm --external cloudflare:workers --external web-push`, { stdio: 'pipe' })
      } catch (err) {
        console.error('[session-hub] Failed to bundle:', String(err))
        return
      }

      // Rename original SvelteKit worker
      if (existsSync(sveltekitPath)) {
        unlinkSync(sveltekitPath)
      }
      renameSync(workerPath, sveltekitPath)

      // Write new entry point wrapper
      const wrapper = [
        '// SESSION_HUB_EXPORT',
        "import worker from './_worker.sveltekit.js'",
        "export { SessionHub } from './_session-hub.js'",
        '',
        String.raw`const WS_ROUTE = /^\/api\/ws\/sessions\/(\d+)$/`,
        '',
        'export default {',
        '  async fetch (request, env, ctx) {',
        '    const url = new URL(request.url)',
        '    const match = url.pathname.match(WS_ROUTE)',
        '',
        "    if (match != null && request.headers.get('Upgrade') === 'websocket') {",
        '      const sessionId = match[1]',
        "      const doId = env.SESSION_HUB.idFromName('session-' + sessionId)",
        '      const stub = env.SESSION_HUB.get(doId)',
        '      return stub.fetch(request)',
        '    }',
        '',
        '    return worker.fetch(request, env, ctx)',
        '  }',
        '}',
        ''
      ].join('\n')

      writeFileSync(workerPath, wrapper)
      console.log('[session-hub] Built worker wrapper with SessionHub export')
    }
  }
}
