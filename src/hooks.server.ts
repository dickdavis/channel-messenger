import { verifySession } from '$lib/session';
import { verifyToken } from '$lib/auth';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

const PUBLIC_PATHS = ['/auth/login', '/auth/callback'];

export const handle: Handle = async ({ event, resolve }) => {
	const secret = event.platform?.env.HMAC_SECRET ?? '';
	const cookieHeader = event.request.headers.get('Cookie');
	event.locals.user = await verifySession(secret, cookieHeader);
	event.locals.apiUser = null;

	// Validate Bearer token for API routes
	if (event.url.pathname.startsWith('/api/')) {
		const authHeader = event.request.headers.get('Authorization');
		if (authHeader?.startsWith('Bearer ')) {
			const db = event.platform!.env.DB;
			event.locals.apiUser = await verifyToken(db, secret, authHeader.slice(7));
		}

		// API routes require either browser session or valid API token
		if (event.locals.user || event.locals.apiUser) {
			return resolve(event);
		}
		return new Response(JSON.stringify({ error: 'Not authenticated' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Allow public paths
	if (PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p))) {
		return resolve(event);
	}

	// Require browser session for everything else
	if (!event.locals.user) {
		redirect(302, '/auth/login');
	}

	return resolve(event);
};
