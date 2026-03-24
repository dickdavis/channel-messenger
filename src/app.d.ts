// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: { id: number; github_id: string; github_username: string; display_name: string | null } | null;
			apiUser: { userId: number } | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				HMAC_SECRET: string;
				GITHUB_CLIENT_ID: string;
				GITHUB_CLIENT_SECRET: string;
				ALLOWED_GITHUB_IDS?: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}

export {};
