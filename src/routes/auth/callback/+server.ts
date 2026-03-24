import { redirect, error } from '@sveltejs/kit';
import { createSessionCookie } from '$lib/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, request, platform }) => {
	const db = platform!.env.DB;
	const secret = platform!.env.HMAC_SECRET;
	const clientId = platform!.env.GITHUB_CLIENT_ID;
	const clientSecret = platform!.env.GITHUB_CLIENT_SECRET;
	const allowedIds = platform!.env.ALLOWED_GITHUB_IDS;

	const code = url.searchParams.get('code');
	if (!code) {
		return error(400, 'Missing code parameter');
	}

	// Verify OAuth state to prevent CSRF
	const state = url.searchParams.get('state');
	const cookieHeader = request.headers.get('Cookie');
	const stateMatch = cookieHeader?.match(/(?:^|;\s*)oauth_state=([^;]+)/);
	if (!state || !stateMatch || state !== stateMatch[1]) {
		return error(400, 'Invalid OAuth state');
	}

	// Exchange code for access token
	const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify({
			client_id: clientId,
			client_secret: clientSecret,
			code
		})
	});

	const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
	if (!tokenData.access_token) {
		return error(400, 'Failed to obtain access token');
	}

	// Fetch GitHub user profile
	const userRes = await fetch('https://api.github.com/user', {
		headers: {
			Authorization: `Bearer ${tokenData.access_token}`,
			'User-Agent': 'channel-messenger'
		}
	});

	const githubUser = (await userRes.json()) as { id: number; login: string; name: string | null };

	// Check allowlist
	if (allowedIds) {
		const allowed = allowedIds.split(',').map((id) => id.trim());
		if (!allowed.includes(String(githubUser.id))) {
			return error(403, 'Your GitHub account is not authorized to use this app');
		}
	}

	// Find or create user
	const githubId = String(githubUser.id);
	let user = await db
		.prepare('SELECT id, github_id, github_username, display_name FROM users WHERE github_id = ?')
		.bind(githubId)
		.first<{ id: number; github_id: string; github_username: string; display_name: string | null }>();

	if (!user) {
		const result = await db
			.prepare('INSERT INTO users (github_id, github_username, display_name) VALUES (?, ?, ?)')
			.bind(githubId, githubUser.login, githubUser.name)
			.run();

		user = {
			id: result.meta.last_row_id as number,
			github_id: githubId,
			github_username: githubUser.login,
			display_name: githubUser.name
		};
	} else {
		// Update username/display name in case they changed
		await db
			.prepare("UPDATE users SET github_username = ?, display_name = ?, updated_at = datetime('now') WHERE id = ?")
			.bind(githubUser.login, githubUser.name, user.id)
			.run();
		user.github_username = githubUser.login;
		user.display_name = githubUser.name;
	}

	const secure = url.protocol === 'https:';
	const cookie = await createSessionCookie(secret, user, secure);

	const clearState = 'oauth_state=; Path=/auth/callback; HttpOnly; SameSite=Lax; Max-Age=0';

	return new Response(null, {
		status: 302,
		headers: [
			['Location', '/'],
			['Set-Cookie', cookie],
			['Set-Cookie', clearState]
		]
	});
};
