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
		background: rgb(51 65 85);
		border-radius: 6px;
	}

	.key-row.revoked {
		opacity: 0.5;
	}

	.key-info {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.9rem;
	}

	.key-name {
		font-weight: 500;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
	}

	time {
		color: #64748b;
		font-size: 0.8rem;
	}

	.badge {
		font-size: 0.75rem;
		padding: 2px 6px;
		border-radius: 4px;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
	}

	.badge.active {
		background: rgba(79, 70, 229, 0.2);
		color: #818cf8;
	}

	.badge.revoked {
		background: rgba(239, 68, 68, 0.15);
		color: #f87171;
	}

	.revoke-btn {
		padding: 4px 10px;
		background: none;
		border: 1px solid #ef4444;
		color: #f87171;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.2s;
	}

	.revoke-btn:hover {
		background: rgba(239, 68, 68, 0.15);
	}
</style>
