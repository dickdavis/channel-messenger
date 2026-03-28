<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import MessageBubble from '$lib/components/MessageBubble.svelte';
	import InputArea from '$lib/components/InputArea.svelte';
	import SessionList from '$lib/components/SessionList.svelte';
	import NewMessagesToast from '$lib/components/NewMessagesToast.svelte';
	import PullToRefreshIndicator from '$lib/components/PullToRefreshIndicator.svelte';
	import { createSessionSocket, type Message } from '$lib/ws';
	import { registerShortcuts } from '$lib/keyboard-shortcuts';

	type Session = { id: number; name: string; status: string; created_at: string };

	let { data } = $props();
	let sessions: Session[] = $state([]);
	let activeSessionId: number | null = $state(null);
	let messages: Message[] = $state([]);
	let sidebarOpen = $state(false);
	let chatContainer: HTMLElement | undefined = $state();
	let socketCleanup: (() => void) | null = null;
	let selectGeneration = 0;
	let inputArea: { focus: () => void } | undefined = $state();

	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	async function fetchSessions() {
		await invalidateAll();
		sessions = data.sessions;
	}

	async function fetchMessages(since?: string) {
		if (!activeSessionId) return;
		let url = `/sessions/${activeSessionId}/messages`;
		if (since != null) url += `?since=${encodeURIComponent(since)}`;
		const res = await fetch(url);
		if (!res.ok) return;
		if (since != null) {
			const newer: Message[] = await res.json();
			for (const msg of newer) {
				if (!messages.some((m) => m.id === msg.id)) {
					messages = [...messages, msg];
				}
			}
		} else {
			messages = await res.json();
		}
	}

	async function selectSession(id: number) {
		const generation = ++selectGeneration;
		socketCleanup?.();
		socketCleanup = null;
		activeSessionId = id;
		sidebarOpen = false;
		messages = [];
		await fetchMessages();
		if (generation !== selectGeneration) return;
		// Use tick to wait for DOM update, then scroll
		await new Promise((r) => setTimeout(r, 0));
		scrollToBottom();

		const { close } = createSessionSocket(id, {
			onMessage (msg) {
				if (!messages.some((m) => m.id === msg.id)) {
					messages = [...messages, msg];
				}
			},
			onConnect (isReconnect) {
				if (!isReconnect) return;
				const last = messages[messages.length - 1];
				fetchMessages(last?.created_at);
			}
		});
		socketCleanup = close;
	}

	async function sendMessage(content: string) {
		if (!activeSessionId) return;
		const res = await fetch(`/sessions/${activeSessionId}/messages`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content })
		});
		if (!res.ok) return;
		const { id }: { id: number } = await res.json();
		if (!messages.some((m) => m.id === id)) {
			messages = [...messages, { id, session_id: activeSessionId, role: 'user', content, created_at: new Date().toISOString() }];
		}
	}

	onMount(() => {
		sessions = data.sessions;
		const params = new URLSearchParams(window.location.search);
		const sessionParam = params.get('session');
		if (sessionParam != null && sessions.some((s) => s.id === Number(sessionParam))) {
			selectSession(Number(sessionParam));
		} else if (sessions.length > 0) {
			selectSession(sessions[0].id);
		}
		const sessionsInterval = setInterval(() => {
			if (document.visibilityState === 'visible') fetchSessions();
		}, 5000);
		const removeShortcuts = registerShortcuts([
			{ key: 'r', handler: refreshMessages },
			{ key: 't', handler () { inputArea?.focus() } },
			{ key: 'Escape', handler () { (document.activeElement as HTMLElement)?.blur() }, activeInInput: true }
		]);
		return () => {
			clearInterval(sessionsInterval);
			socketCleanup?.();
			removeShortcuts();
		};
	});

	let refreshing = $state(false);

	async function refreshMessages() {
		refreshing = true;
		const [last] = [messages[messages.length - 1]];
		await Promise.all([
			fetchMessages(last?.created_at),
			new Promise((resolve) => setTimeout(resolve, 1000))
		]);
		refreshing = false;
	}
</script>

<div class="app">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	{#if sidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="overlay" onclick={() => (sidebarOpen = false)}></div>
	{/if}

	<div class="sidebar" class:open={sidebarOpen}>
		<div class="sidebar-header">
			<h2>Sessions</h2>
			<button class="close-btn" aria-label="Close sidebar" onclick={() => (sidebarOpen = false)}>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
					<path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				</svg>
			</button>
		</div>
		<SessionList {sessions} {activeSessionId} onSelect={selectSession} />
	</div>

	<header>
		<div class="header-left">
			<button class="menu-btn" aria-label="Open sessions" onclick={() => (sidebarOpen = !sidebarOpen)}>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
					<path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				</svg>
			</button>
			<h1>
				{#if activeSessionId}
					{sessions.find((s) => s.id === activeSessionId)?.name ?? 'Messenger'}
				{:else}
					Messenger
				{/if}
			</h1>
		</div>
		<a href="/settings" class="settings-link">Settings</a>
	</header>

	<div class="messages-wrapper">
	<NewMessagesToast container={chatContainer} {messages} onScrollToBottom={scrollToBottom} />
	{#if refreshing}
		<div class="refresh-overlay">
			<span class="spinner"></span>
		</div>
	{/if}
	<div class="messages" bind:this={chatContainer}>
		{#if activeSessionId}
			{#each messages as msg (msg.id)}
				<MessageBubble content={msg.content} role={msg.role} createdAt={msg.created_at} />
			{/each}
			{#if messages.length === 0}
				<p class="empty">No messages yet. Send one below.</p>
			{/if}
		{:else}
			<p class="empty">Select a session to start chatting.</p>
		{/if}
		<PullToRefreshIndicator container={chatContainer} onRefresh={refreshMessages} />
	</div>
	</div>

	{#if activeSessionId}
		<InputArea bind:this={inputArea} onSend={sendMessage} />
	{/if}
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
		background: var(--color-bg);
		position: relative;
		overflow: hidden;
	}

	/* Sidebar */
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		z-index: 10;
	}

	.sidebar {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		width: 260px;
		background: var(--color-bg);
		z-index: 20;
		transform: translateX(-100%);
		transition: transform 0.2s ease;
		display: flex;
		flex-direction: column;
		box-shadow: 2px 0 12px rgba(0, 0, 0, 0.3);
	}

	.sidebar.open {
		transform: translateX(0);
	}

	.sidebar-header {
		padding: 12px 16px;
		background: var(--color-primary);
		color: #fff;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.sidebar-header h2 {
		margin: 0;
		font-size: var(--text-xl);
		font-family: var(--font-mono);
	}

	.close-btn {
		background: none;
		border: none;
		color: #fff;
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		opacity: 0.9;
	}

	.close-btn:hover {
		opacity: 1;
	}

	/* Header */
	header {
		padding: 12px 16px;
		background: var(--color-primary);
		color: #fff;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.menu-btn {
		background: none;
		border: none;
		color: #fff;
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
	}

	header h1 {
		margin: 0;
		font-size: var(--text-2xl);
		font-family: var(--font-mono);
	}

	.settings-link {
		color: #fff;
		text-decoration: none;
		font-size: var(--text-md);
		font-family: var(--font-mono);
		opacity: 0.9;
	}

	.settings-link:hover {
		opacity: 1;
	}

	/* Messages */
	.messages-wrapper {
		flex: 1;
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		overscroll-behavior-y: none;
	}

	.refresh-overlay {
		position: absolute;
		inset: 0;
		z-index: 4;
		background: rgba(0, 0, 0, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.empty {
		text-align: center;
		color: var(--color-text-dim);
		margin-top: 40px;
	}
</style>
