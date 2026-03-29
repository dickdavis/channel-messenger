<script lang="ts">
	import type { PermissionRequest } from '$lib/ws'

	let {
		request,
		onRespond
	}: {
		request: PermissionRequest | null
		onRespond: (requestId: string, behavior: 'allow' | 'deny', toolName: string, description: string) => void
	} = $props()

	let showInput = $state(false)

	function formatJson (raw: string): string {
		try {
			return JSON.stringify(JSON.parse(raw), null, 2)
		} catch {
			return raw
		}
	}

	function respond (behavior: 'allow' | 'deny') {
		if (request == null) return
		onRespond(request.request_id, behavior, request.tool_name, request.description)
		showInput = false
	}
</script>

{#if request != null}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="overlay">
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<p class="tool-name">{request.tool_name}</p>
			<p class="description">{request.description}</p>

			{#if !showInput && request.input_preview}
				<button class="see-more" onclick={() => (showInput = true)}>See more...</button>
			{/if}
			{#if showInput && request.input_preview}
				<pre class="input-preview"><code>{formatJson(request.input_preview)}</code></pre>
			{/if}

			<div class="actions">
				<button class="btn deny" onclick={() => respond('deny')}>Deny</button>
				<button class="btn allow" onclick={() => respond('allow')}>Allow</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal {
		background: var(--color-bg-raised);
		border-radius: var(--radius-lg);
		padding: 20px;
		max-width: 400px;
		width: 90%;
	}

	.tool-name {
		font-weight: 600;
		font-size: var(--text-lg);
		color: var(--color-text);
		margin: 0 0 8px;
	}

	.description {
		color: var(--color-text-muted);
		font-size: var(--text-base);
		margin: 0 0 12px;
	}

	.see-more {
		background: none;
		border: none;
		color: var(--color-primary-light);
		cursor: pointer;
		padding: 0;
		font-size: var(--text-base);
		margin-bottom: 12px;
	}

	.see-more:hover {
		color: var(--color-primary-lighter);
	}

	.input-preview {
		background: var(--color-bg-deep);
		color: #d4d4d4;
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		overflow-x: auto;
		max-height: 200px;
		overflow-y: auto;
		font-size: var(--text-base);
		margin: 0 0 12px;
	}

	.input-preview code {
		background: none;
		padding: 0;
	}

	.actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		margin-top: 16px;
	}

	.btn {
		padding: 8px 20px;
		border: none;
		border-radius: var(--radius-sm);
		color: #fff;
		cursor: pointer;
		font-size: var(--text-base);
		font-weight: 500;
	}

	.btn.allow {
		background: var(--color-primary);
	}

	.btn.allow:hover {
		background: var(--color-primary-hover);
	}

	.btn.deny {
		background: var(--color-danger);
	}

	.btn.deny:hover {
		background: var(--color-danger-light);
	}
</style>
