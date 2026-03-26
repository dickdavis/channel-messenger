# Channel Messenger

A personal chat interface for communicating with Claude Code sessions, built with SvelteKit and deployed to Cloudflare.

## Setup

### Prerequisites

- [Bun](https://bun.sh) runtime installed
- A GitHub account

### Install dependencies

```sh
bun install
```

### GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: Channel Messenger (or whatever you like)
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:5173/auth/callback`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy the secret

### Environment variables

Create a `.dev.vars` file in the project root:

```
HMAC_SECRET=<run `openssl rand -hex 32` to generate>
GITHUB_CLIENT_ID=<your client id>
GITHUB_CLIENT_SECRET=<your client secret>
```

### Wrangler config

Create a local D1 database and generate `wrangler.toml` from the example:

```sh
bunx wrangler d1 create messenger-db
```

Copy the returned `database_id` and generate your config:

```sh
sed 's/D1_DATABASE_ID_PLACEHOLDER/<your-database-id>/' wrangler.toml.example > wrangler.toml
```

Then update `ALLOWED_GITHUB_IDS` in `.dev.vars` with your GitHub user ID (see below).

### Database setup

```sh
bun run db:migrate
```

### Push notifications (optional)

Generate a VAPID key pair:

```sh
bunx web-push generate-vapid-keys
```

Add the public key to `.dev.vars`:

```
VAPID_PUBLIC_KEY=<your public key>
VAPID_PRIVATE_KEY=<your private key>
VAPID_SUBJECT=mailto:<your email>
```

Push notifications work both locally and in production. On Safari/WebKit, the app must be installed as a PWA (Add to Dock) for push to work.

### Run the dev server

```sh
bun run dev
```

### Lock down access

After logging in for the first time via GitHub, get your GitHub user ID:

```sh
echo "SELECT id, github_id, github_username FROM users;" > /tmp/q.sql && bun run db:query /tmp/q.sql
```

Copy your `github_id` value and add it to `.dev.vars`:

```
ALLOWED_GITHUB_IDS=<your github id>
```

Restart the dev server. Only the listed GitHub accounts will be able to log in. Multiple IDs can be comma-separated.

## Routes

### API routes (MCP server)

Authenticated via `Authorization: Bearer <token>` header.

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/sessions` | Register a new session. Accepts optional `name` in body; returns `id` and `name`. |
| `GET` | `/api/sessions/:id/messages?since=<timestamp>` | Poll for messages. Use `since` to get only new messages. |
| `POST` | `/api/sessions/:id/messages` | Send a message as the assistant. Body: `{ "content": "..." }` |
| `GET` | `/api/ws/sessions/:id` | WebSocket upgrade. Authenticate by sending `{"type":"auth","token":"<token>"}` as the first message within 5 seconds. Receives `{"type":"message","message":{...}}` on new messages. |

### Auth routes (browser)

| Method | Route | Description |
|---|---|---|
| `GET` | `/auth/login` | Redirects to GitHub OAuth |
| `GET` | `/auth/callback` | OAuth callback; creates user if needed, sets session cookie |
| `GET` | `/auth/logout` | Clears session cookie |

### Internal routes (browser)

Authenticated via session cookie. Used by the UI only.

| Method | Route | Description |
|---|---|---|
| `POST` | `/settings/keys` | Generate a new API key |
| `GET` | `/settings/keys` | List API keys |
| `DELETE` | `/settings/keys/:id` | Revoke an API key |
| `POST` | `/settings/push` | Subscribe to push notifications |
| `DELETE` | `/settings/push` | Unsubscribe from push notifications |
| `GET` | `/sessions/:id/messages` | Poll for messages |
| `POST` | `/sessions/:id/messages` | Send a message as the user. Body: `{ "content": "..." }` |

## Deployment

### One-time setup

1. Create the D1 database (if not already done during local setup):
   ```sh
   bunx wrangler d1 create messenger-db
   ```

2. Apply the migration to production:
   ```sh
   bun run db:migrate:remote
   ```

3. Set production secrets:
   ```sh
   bunx wrangler secret put HMAC_SECRET
   bunx wrangler secret put GITHUB_CLIENT_ID
   bunx wrangler secret put GITHUB_CLIENT_SECRET
   bunx wrangler secret put VAPID_PRIVATE_KEY
   ```

4. Set plaintext environment variables in the Cloudflare dashboard under Workers & Pages > your worker > Settings > Variables:
   - `ALLOWED_GITHUB_IDS` — comma-separated list of GitHub user IDs
   - `VAPID_PUBLIC_KEY` — the public key from `bunx web-push generate-vapid-keys`
   - `VAPID_SUBJECT` — `mailto:<your email>`

5. Create a production GitHub OAuth App at https://github.com/settings/developers:
   - **Homepage URL**: `https://<your-domain>`
   - **Callback URL**: `https://<your-domain>/auth/callback`

6. Configure a custom domain in the Cloudflare dashboard under Workers & Pages > your worker > Settings > Domains & Routes.

7. Connect the GitHub repo in the Cloudflare dashboard:
   - Go to Workers & Pages > Create > Connect to Git
   - Build command: `sed "s/D1_DATABASE_ID_PLACEHOLDER/$D1_DATABASE_ID/" wrangler.toml.example > wrangler.toml && bun run build`
   - Deploy command: `bunx wrangler deploy`
   - Set `D1_DATABASE_ID` as an environment variable in the build settings

Every push to `main` triggers an automatic build and deploy.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server (includes WebSocket support) |
| `bun run build` | Production build |
| `bun run check` | Type-check |
| `bun run db:migrate` | Apply migrations locally |
| `bun run db:migrate:remote` | Apply migrations to production |
| `bun run db:reset` | Nuke local DB and re-apply migrations |
| `bun run db:query <file>` | Run a SQL file against local DB |
