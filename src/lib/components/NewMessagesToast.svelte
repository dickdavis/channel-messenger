<script lang="ts">
	import type { Message } from '$lib/ws';

	let {
		container,
		messages,
		onScrollToBottom
	}: {
		container: HTMLElement | undefined
		messages: Message[]
		onScrollToBottom: () => void
	} = $props();

	let visible = $state(false);
	let lastMessageCount = 0;

	function isNearBottom (): boolean {
		if (!container) return true;
		const threshold = 100;
		return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
	}

	$effect(() => {
		if (messages.length !== lastMessageCount) {
			lastMessageCount = messages.length;
			if (isNearBottom()) {
				onScrollToBottom();
				visible = false;
			} else {
				visible = true;
			}
		}
	});

	$effect(() => {
		if (!container || messages.length === 0) return;
		const lastChild = container.lastElementChild as HTMLElement | null;
		if (!lastChild) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting && visible) {
					visible = false;
				}
			},
			{ root: container, threshold: 0.1 }
		);
		observer.observe(lastChild);
		return () => observer.disconnect();
	});

	function handleClick () {
		onScrollToBottom();
		visible = false;
	}
</script>

{#if visible}
	<button class="new-messages-toast" onclick={handleClick}>New messages</button>
{/if}

<style>
	.new-messages-toast {
		position: absolute;
		bottom: 12px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 5;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-full);
		padding: 6px 16px;
		font-size: var(--text-base);
		font-family: var(--font-mono);
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
		transition: var(--transition);
	}

	.new-messages-toast:hover {
		background: var(--color-primary-hover);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
	}
</style>
