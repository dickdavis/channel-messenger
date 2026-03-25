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
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
		background: var(--color-bg);
	}

	header {
		padding: 12px 16px;
		background: var(--color-primary);
		color: #fff;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	header h1 {
		margin: 0;
		font-size: var(--text-2xl);
		font-family: var(--font-mono);
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
		max-width: 640px;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
	}

	h2 {
		margin: 0 0 4px;
		font-size: var(--text-xl);
		font-family: var(--font-mono);
	}

	.description {
		color: var(--color-text-muted);
		font-size: var(--text-md);
		margin: 0 0 16px;
	}

	.token-display {
		background: var(--color-primary-bg-subtle);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-lg);
		padding: 12px;
		margin-bottom: 16px;
	}

	.token-display p {
		margin: 0 0 4px;
	}

	.token-display code {
		display: block;
		background: var(--color-bg-deep);
		color: var(--color-primary-light);
		padding: 10px;
		border-radius: var(--radius-sm);
		font-size: var(--text-base);
		word-break: break-all;
		margin: 8px 0;
	}

	.warning {
		color: var(--color-warning);
		font-size: var(--text-base);
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
		border: 1px solid var(--color-bg-raised);
		border-radius: var(--radius-md);
		font-size: var(--text-md);
		font-family: inherit;
		background: var(--color-bg-deep);
		color: var(--color-text);
	}

	.create-key input::placeholder {
		color: var(--color-text-dim);
	}

	.create-key input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.create-key button {
		padding: 8px 16px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: var(--text-md);
		font-family: var(--font-mono);
		font-weight: 600;
		white-space: nowrap;
		transition: var(--transition);
		box-shadow: var(--shadow-btn);
	}

	.create-key button:hover {
		background: var(--color-primary-hover);
		box-shadow: var(--shadow-btn-hover);
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
		color: var(--color-text-dim);
		margin-top: 20px;
	}
</style>
