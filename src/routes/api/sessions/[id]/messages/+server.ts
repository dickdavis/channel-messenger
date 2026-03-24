import { json, error } from '@sveltejs/kit';
import { resolveUserId } from '$lib/auth';
import type { RequestHandler } from './$types';

// GET /api/sessions/:id/messages — poll for messages
export const GET: RequestHandler = async ({ params, url, locals, platform }) => {
	const userId = resolveUserId(locals);
	if (!userId) return error(401, 'Not authenticated');
	const db = platform!.env.DB;

	const session = await db
		.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?')
		.bind(params.id, userId)
		.first();

	if (!session) {
		return error(404, 'Session not found');
	}

	const since = url.searchParams.get('since');
	if (since && !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(since)) {
		return error(400, 'Invalid since parameter');
	}

	let query: string;
	let bindings: unknown[];

	if (since) {
		query =
			'SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = ? AND created_at > ? ORDER BY created_at ASC';
		bindings = [params.id, since];
	} else {
		query =
			'SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC';
		bindings = [params.id];
	}

	const { results } = await db.prepare(query).bind(...bindings).all();

	return json(results);
};

// POST /api/sessions/:id/messages — send a message
export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	const userId = resolveUserId(locals);
	if (!userId) return error(401, 'Not authenticated');
	const db = platform!.env.DB;

	const session = await db
		.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?')
		.bind(params.id, userId)
		.first();

	if (!session) {
		return error(404, 'Session not found');
	}

	const { content, role } = (await request.json()) as { content?: string; role?: string };

	if (!content || !role) {
		return error(400, 'Missing content or role');
	}

	if (role !== 'user' && role !== 'assistant') {
		return error(400, 'Role must be "user" or "assistant"');
	}

	const result = await db
		.prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)')
		.bind(params.id, role, content)
		.run();

	await db
		.prepare("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?")
		.bind(params.id)
		.run();

	return json({ id: result.meta.last_row_id });
};
