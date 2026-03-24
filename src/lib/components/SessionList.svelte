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
		color: #f4f4f5;
		cursor: pointer;
		text-align: left;
		font-size: 0.9rem;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		border-bottom: 1px solid rgb(51 65 85);
	}

	.session-item:hover {
		background: rgb(51 65 85);
	}

	.session-item.active {
		background: rgba(79, 70, 229, 0.2);
		border-left: 3px solid #4f46e5;
	}

	.session-name {
		font-weight: 500;
	}

	.session-status {
		font-size: 0.75rem;
		color: #818cf8;
	}

	.session-status.inactive {
		color: #64748b;
	}

	.empty {
		text-align: center;
		color: #64748b;
		margin-top: 20px;
	}
</style>
