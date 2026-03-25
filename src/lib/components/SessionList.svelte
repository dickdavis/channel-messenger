<script lang="ts">
	type Session = { id: number; name: string; status: string };

	let {
		sessions,
		activeSessionId,
		onSelect
	}: {
		sessions: Session[];
		activeSessionId: number | null;
		onSelect: (id: number) => void;
	} = $props();
</script>

<div class="session-list">
	{#each sessions as session (session.id)}
		<button
			class="session-item"
			class:active={session.id === activeSessionId}
			onclick={() => onSelect(session.id)}
		>
			<span class="session-name">{session.name}</span>
			<span class="session-status" class:inactive={session.status === 'inactive'}>
				{session.status}
			</span>
		</button>
	{/each}
	{#if sessions.length === 0}
		<p class="empty">No sessions yet.</p>
	{/if}
</div>

<style>
	.session-list {
		flex: 1;
		overflow-y: auto;
	}

	.session-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 12px 16px;
		border: none;
		background: none;
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
		font-size: var(--text-md);
		font-family: var(--font-mono);
		border-bottom: 1px solid var(--color-bg-raised);
	}

	.session-item:hover {
		background: var(--color-bg-raised);
	}

	.session-item.active {
		background: var(--color-primary-bg);
		border-left: 3px solid var(--color-primary);
	}

	.session-name {
		font-weight: 500;
	}

	.session-status {
		font-size: var(--text-sm);
		color: var(--color-primary-light);
	}

	.session-status.inactive {
		color: var(--color-text-dim);
	}

	.empty {
		text-align: center;
		color: var(--color-text-dim);
		margin-top: 20px;
	}
</style>
