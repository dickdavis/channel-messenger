import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.user) redirect(302, '/auth/login');
	const db = platform!.env.DB;

	const { results } = await db
		.prepare(
			'SELECT id, name, created_at, revoked_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC'
		)
		.bind(locals.user.id)
		.all();

	return {
		keys: results as Array<{
			id: number;
			name: string | null;
			created_at: string;
			revoked_at: string | null;
		}>
	};
};
