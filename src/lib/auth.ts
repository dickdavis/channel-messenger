export async function hmacSign(secret: string, data: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
	return Array.from(new Uint8Array(signature))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function generateToken(): Promise<string> {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function hashToken(secret: string, token: string): Promise<string> {
	return hmacSign(secret, token);
}

export async function verifyToken(
	db: D1Database,
	secret: string,
	token: string
): Promise<{ userId: number } | null> {
	const tokenHash = await hashToken(secret, token);
	const row = await db
		.prepare('SELECT user_id FROM api_keys WHERE token_hash = ? AND revoked_at IS NULL')
		.bind(tokenHash)
		.first<{ user_id: number }>();
	if (!row) return null;
	return { userId: row.user_id };
}

export function resolveUserId(locals: App.Locals): number | null {
	return locals.user?.id ?? locals.apiUser?.userId ?? null;
}
