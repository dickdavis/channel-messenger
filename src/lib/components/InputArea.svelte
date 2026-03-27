<script lang="ts">
	let { onSend }: { onSend: (content: string) => void } = $props();
	let input = $state('');
	let textarea: HTMLTextAreaElement;

	function resize() {
		textarea.style.height = 'auto'
		textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
	}

	$effect(() => {
		input;
		resize();
	});

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
		bind:this={textarea}
		bind:value={input}
		onkeydown={handleKeydown}
		placeholder="Type a message..."
		rows="1"
	></textarea>
</form>

<style>
	.input-border {
		border-top: 1px solid var(--color-bg-raised);
	}

	.input-area {
		display: flex;
		padding: 8px 16px;
		margin-left: auto;
		width: 75%;
		box-sizing: border-box;
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
		overflow-y: auto;
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

</style>
