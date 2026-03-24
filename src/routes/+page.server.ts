import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.user) redirect(302, '/auth/login');
	const db = platform!.env.DB;

	const { results: sessions } = await db
		.prepare(
			'SELECT id, name, status, created_at FROM sessions WHERE user_id = ? ORDER BY updated_at DESC'
		)
		.bind(locals.user.id)
		.all();

	return {
		sessions: sessions as Array<{
			id: number;
			name: string;
			status: string;
			created_at: string;
		}>
	};
};
