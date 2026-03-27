<script lang="ts">
	let { onSend }: { onSend: (content: string) => void } = $props();
	let input = $state('');

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}

	function submit() {
		const content = input.trim();
		if (!content) return;
		input = '';
		onSend(content);
	}
</script>

<div class="input-border"></div>
<form class="input-area" onsubmit={(e) => { e.preventDefault(); submit(); }}>
	<textarea
		bind:value={input}
		onkeydown={handleKeydown}
		placeholder="Type a message..."
		rows="1"
	></textarea>
	<button type="submit">Send</button>
</form>

<style>
	.input-border {
		border-top: 1px solid var(--color-bg-raised);
	}

	.input-area {
		display: flex;
		padding: 8px 16px;
		gap: 8px;
		margin-left: auto;
		width: 75%;
	}

	@media (max-width: 640px) {
		.input-area {
			width: 100%;
		}
	}

	textarea {
		flex: 1;
		padding: 10px;
		border: 1px solid var(--color-bg-raised);
		border-radius: var(--radius-pill);
		resize: none;
		font-size: var(--text-lg);
		font-family: inherit;
		outline: none;
		background: var(--color-bg-deep);
		color: var(--color-text);
	}

	textarea::placeholder {
		color: var(--color-text-dim);
	}

	textarea:focus {
		border-color: var(--color-primary);
	}

	button {
		padding: 10px 20px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-pill);
		cursor: pointer;
		font-size: var(--text-lg);
		font-family: var(--font-mono);
		font-weight: 600;
		transition: var(--transition);
		box-shadow: var(--shadow-btn);
	}

	button:hover {
		background: var(--color-primary-hover);
		box-shadow: var(--shadow-btn-hover);
	}

	button:active {
		transform: scale(0.95);
	}
</style>
