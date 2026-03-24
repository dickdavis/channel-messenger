import { hmacSign } from './auth';

interface SessionPayload {
	userId: number;
	githubId: string;
	githubUsername: string;
	displayName: string | null;
	exp: number;
}

const SESSION_COOKIE = 'session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSessionCookie(
	secret: string,
	user: { id: number; github_id: string; github_username: string; display_name: string | null },
	secure = true
): Promise<string> {
	const payload: SessionPayload = {
		userId: user.id,
		githubId: user.github_id,
		githubUsername: user.github_username,
		displayName: user.display_name,
		exp: Date.now() + SESSION_DURATION_MS
	};
	const data = btoa(JSON.stringify(payload));
	const signature = await hmacSign(secret, data);
	const value = `${data}.${signature}`;

	const secureFlag = secure ? ' Secure;' : '';
	return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly;${secureFlag} SameSite=Lax; Max-Age=${SESSION_DURATION_MS / 1000}`;
}

export async function verifySession(
	secret: string,
	cookieHeader: string | null
): Promise<App.Locals['user']> {
	if (!cookieHeader) return null;

	const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
	if (!match) return null;

	const [data, signature] = match[1].split('.');
	if (!data || !signature) return null;

	const expected = await hmacSign(secret, data);
	const a = await hmacSign(secret, signature);
	const b = await hmacSign(secret, expected);
	if (a !== b) return null;

	try {
		const payload: SessionPayload = JSON.parse(atob(data));
		if (payload.exp < Date.now()) return null;
		return {
			id: payload.userId,
			github_id: payload.githubId,
			github_username: payload.githubUsername,
			display_name: payload.displayName
		};
	} catch {
		return null;
	}
}

export function clearSessionCookie(): string {
	return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
