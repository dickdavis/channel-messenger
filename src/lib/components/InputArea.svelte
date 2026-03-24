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
		border-top: 1px solid rgb(51 65 85);
	}

	.input-area {
		display: flex;
		padding: 8px 16px;
		gap: 8px;
		margin-left: auto;
		width: 75%;
	}

	textarea {
		flex: 1;
		padding: 10px;
		border: 1px solid rgb(51 65 85);
		border-radius: 20px;
		resize: none;
		font-size: 1rem;
		font-family: inherit;
		outline: none;
		background: rgb(15 23 42);
		color: #f4f4f5;
	}

	textarea::placeholder {
		color: #64748b;
	}

	textarea:focus {
		border-color: #4f46e5;
	}

	button {
		padding: 10px 20px;
		background: #4f46e5;
		color: #fff;
		border: none;
		border-radius: 20px;
		cursor: pointer;
		font-size: 1rem;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		font-weight: 600;
		transition: all 0.2s;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	button:hover {
		background: #4338ca;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
	}

	button:active {
		transform: scale(0.95);
	}
</style>
