import { json, error } from '@sveltejs/kit';
import { generateToken, hashToken } from '$lib/auth';
import type { RequestHandler } from './$types';

// POST /api/keys — generate a new API key (browser session auth)
export const POST: RequestHandler = async ({ locals, request, platform }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const db = platform!.env.DB;
	const secret = platform!.env.HMAC_SECRET;

	const body = (await request.json().catch(() => ({}))) as { name?: string };
	const name = body.name || null;

	const token = await generateToken();
	const tokenHash = await hashToken(secret, token);

	await db
		.prepare('INSERT INTO api_keys (user_id, token_hash, name) VALUES (?, ?, ?)')
		.bind(locals.user.id, tokenHash, name)
		.run();

	return json({ token, name });
};
