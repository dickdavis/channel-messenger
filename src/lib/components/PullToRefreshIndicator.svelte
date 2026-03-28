<script lang="ts">
	let {
		container,
		onRefresh
	}: {
		container: HTMLElement | undefined
		onRefresh: () => Promise<void>
	} = $props();

	let pulling = $state(false);
	let pullDistance = $state(0);
	let refreshing = $state(false);
	const threshold = 60;
	let startY = 0;

	function isNearBottom (): boolean {
		if (!container) return true;
		return container.scrollHeight - container.scrollTop - container.clientHeight < 100;
	}

	$effect(() => {
		if (!container) return;
		const el = container;

		function handleTouchStart (e: TouchEvent) {
			if (!isNearBottom()) return;
			startY = e.touches[0].clientY;
			pulling = true;
			pullDistance = 0;
		}

		function handleTouchMove (e: TouchEvent) {
			if (!pulling) return;
			pullDistance = Math.max(0, e.touches[0].clientY - startY);
		}

		async function handleTouchEnd () {
			if (pulling && pullDistance >= threshold) {
				refreshing = true;
				await onRefresh();
				refreshing = false;
			}
			pulling = false;
			pullDistance = 0;
		}

		el.addEventListener('touchstart', handleTouchStart);
		el.addEventListener('touchmove', handleTouchMove);
		el.addEventListener('touchend', handleTouchEnd);

		return () => {
			el.removeEventListener('touchstart', handleTouchStart);
			el.removeEventListener('touchmove', handleTouchMove);
			el.removeEventListener('touchend', handleTouchEnd);
		};
	});
</script>

{#if pulling || refreshing}
	<div class="pull-indicator" style:opacity={refreshing ? 1 : Math.min(pullDistance / threshold, 1)}>
		{refreshing ? 'Checking…' : 'Pull to refresh'}
	</div>
{/if}

<style>
	.pull-indicator {
		text-align: center;
		color: var(--color-text-dim);
		font-size: var(--text-sm);
		font-family: var(--font-mono);
		padding: 8px 0;
	}
</style>
