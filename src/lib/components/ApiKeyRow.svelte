<script lang="ts">
	let {
		name,
		createdAt,
		revokedAt,
		onRevoke
	}: {
		name: string | null;
		createdAt: string;
		revokedAt: string | null;
		onRevoke: () => void;
	} = $props();
</script>

<div class="key-row" class:revoked={revokedAt}>
	<div class="key-info">
		<span class="key-name">{name || 'Unnamed key'}</span>
		<time>{new Date(createdAt + 'Z').toLocaleDateString()}</time>
		{#if revokedAt}
			<span class="badge revoked">Revoked</span>
		{:else}
			<span class="badge active">Active</span>
		{/if}
	</div>
	{#if !revokedAt}
		<button class="revoke-btn" onclick={onRevoke}>Revoke</button>
	{/if}
</div>

<style>
	.key-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 12px;
		background: var(--color-bg-raised);
		border-radius: var(--radius-md);
	}

	.key-row.revoked {
		opacity: 0.5;
	}

	.key-info {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: var(--text-md);
	}

	.key-name {
		font-weight: 500;
		font-family: var(--font-mono);
	}

	time {
		color: var(--color-text-dim);
		font-size: var(--text-base);
	}

	.badge {
		font-size: var(--text-sm);
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
	}

	.badge.active {
		background: var(--color-primary-bg);
		color: var(--color-primary-light);
	}

	.badge.revoked {
		background: var(--color-danger-bg);
		color: var(--color-danger-light);
	}

	.revoke-btn {
		padding: 4px 10px;
		background: none;
		border: 1px solid var(--color-danger);
		color: var(--color-danger-light);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: var(--text-base);
		transition: var(--transition);
	}

	.revoke-btn:hover {
		background: var(--color-danger-bg);
	}
</style>
