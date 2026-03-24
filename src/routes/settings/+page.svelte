<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import ApiKeyRow from '$lib/components/ApiKeyRow.svelte';

	type ApiKey = { id: number; name: string | null; created_at: string; revoked_at: string | null };

	let { data } = $props();
	let keys: ApiKey[] = $state([]);
	let newKeyName = $state('');
	let generatedToken: string | null = $state(null);
	let errorMessage: string | null = $state(null);

	onMount(() => {
		keys = data.keys;
	});

	async function createKey() {
		errorMessage = null;
		const res = await fetch('/settings/keys', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newKeyName.trim() || null })
		});
		if (!res.ok) {
			errorMessage = 'Failed to create API key';
			return;
		}
		const result = (await res.json()) as { token: string; name: string | null };
		generatedToken = result.token;
		newKeyName = '';
		await invalidateAll();
		keys = data.keys;
	}

	async function revokeKey(id: number) {
		errorMessage = null;
		const res = await fetch(`/settings/keys/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			errorMessage = 'Failed to revoke API key';
			return;
		}
		generatedToken = null;
		await invalidateAll();
		keys = data.keys;
	}
</script>

<div class="app">
	<header>
		<a href="/" class="back" aria-label="Back">
			<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
				<path d="M13 4l-6 6 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</a>
		<h1>Settings</h1>
	</header>

	<div class="content">
		<section>
			<h2>API Keys</h2>
			<p class="description">
				Generate an API key to authenticate your MCP servers. Set it as an environment variable for
				your Claude Code channel plugin.
			</p>

			{#if generatedToken}
				<div class="token-display">
					<p><strong>Your new API key:</strong></p>
					<code>{generatedToken}</code>
					<p class="warning">Copy this now — it won't be shown again.</p>
				</div>
			{/if}

			<form class="create-key" onsubmit={(e) => { e.preventDefault(); createKey(); }}>
				<input type="text" bind:value={newKeyName} placeholder="Key name (optional)" />
				<button type="submit">Generate Key</button>
			</form>

			<div class="key-list">
				{#each keys as key (key.id)}
					<ApiKeyRow
						name={key.name}
						createdAt={key.created_at}
						revokedAt={key.revoked_at}
						onRevoke={() => revokeKey(key.id)}
					/>
				{/each}

				{#if keys.length === 0}
					<p class="empty">No API keys yet.</p>
				{/if}
			</div>
		</section>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: rgb(15 23 42);
		color: #f4f4f5;
	}

	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
		background: rgb(30 41 59);
	}

	header {
		padding: 12px 16px;
		background: #4f46e5;
		color: #fff;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	header h1 {
		margin: 0;
		font-size: 1.2rem;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
	}

	.back {
		color: #fff;
		text-decoration: none;
		display: flex;
		align-items: center;
	}

	.content {
		flex: 1;
		padding: 24px 16px;
		overflow-y: auto;
	}

	h2 {
		margin: 0 0 4px;
		font-size: 1.1rem;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
	}

	.description {
		color: #94a3b8;
		font-size: 0.9rem;
		margin: 0 0 16px;
	}

	.token-display {
		background: rgba(79, 70, 229, 0.15);
		border: 1px solid #4f46e5;
		border-radius: 8px;
		padding: 12px;
		margin-bottom: 16px;
	}

	.token-display p {
		margin: 0 0 4px;
	}

	.token-display code {
		display: block;
		background: rgb(15 23 42);
		color: #818cf8;
		padding: 10px;
		border-radius: 4px;
		font-size: 0.85rem;
		word-break: break-all;
		margin: 8px 0;
	}

	.warning {
		color: #fbbf24;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.create-key {
		display: flex;
		gap: 8px;
		margin-bottom: 20px;
	}

	.create-key input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid rgb(51 65 85);
		border-radius: 6px;
		font-size: 0.9rem;
		font-family: inherit;
		background: rgb(15 23 42);
		color: #f4f4f5;
	}

	.create-key input::placeholder {
		color: #64748b;
	}

	.create-key input:focus {
		outline: none;
		border-color: #4f46e5;
	}

	.create-key button {
		padding: 8px 16px;
		background: #4f46e5;
		color: #fff;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		font-weight: 600;
		white-space: nowrap;
		transition: all 0.2s;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.create-key button:hover {
		background: #4338ca;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
	}

	.create-key button:active {
		transform: scale(0.95);
	}

	.key-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.empty {
		text-align: center;
		color: #64748b;
		margin-top: 20px;
	}
</style>
