<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import MessageBubble from '$lib/components/MessageBubble.svelte';
	import InputArea from '$lib/components/InputArea.svelte';
	import SessionList from '$lib/components/SessionList.svelte';
	import { createSessionSocket, type Message } from '$lib/ws';

	type Session = { id: number; name: string; status: string; created_at: string };

	let { data } = $props();
	let sessions: Session[] = $state([]);
	let activeSessionId: number | null = $state(null);
	let messages: Message[] = $state([]);
	let lastMessageCount = 0;
	let hasNewMessages = $state(false);
	let sidebarOpen = $state(false);
	let chatContainer: HTMLElement;
	let socketCleanup: (() => void) | null = null;
	let selectGeneration = 0;

	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
			hasNewMessages = false;
		}
	}

	function isNearBottom(): boolean {
		if (!chatContainer) return true;
		const threshold = 100;
		return chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < threshold;
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
		if (sessions.length > 0) {
			selectSession(sessions[0].id);
		}
		const sessionsInterval = setInterval(() => {
			if (document.visibilityState === 'visible') fetchSessions();
		}, 5000);
		return () => {
			clearInterval(sessionsInterval);
			socketCleanup?.();
		};
	});

	$effect(() => {
		if (messages.length !== lastMessageCount) {
			lastMessageCount = messages.length;
			if (isNearBottom()) {
				scrollToBottom();
			} else {
				hasNewMessages = true;
			}
		}
	});
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
	{#if hasNewMessages}
		<button class="new-messages-toast" onclick={scrollToBottom}>New messages</button>
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
	</div>
	</div>

	{#if activeSessionId}
		<InputArea onSend={sendMessage} />
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: rgb(15 23 42);
		color: #f4f4f5;
	}

	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
		background: rgb(30 41 59);
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
		background: rgb(30 41 59);
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
		background: #4f46e5;
		color: #fff;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.sidebar-header h2 {
		margin: 0;
		font-size: 1.1rem;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
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
		background: #4f46e5;
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
		font-size: 1.2rem;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
	}

	.settings-link {
		color: #fff;
		text-decoration: none;
		font-size: 0.9rem;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
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

	.new-messages-toast {
		position: absolute;
		bottom: 12px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 5;
		background: #4f46e5;
		color: #fff;
		border: none;
		border-radius: 16px;
		padding: 6px 16px;
		font-size: 0.85rem;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
		transition: all 0.2s;
	}

	.new-messages-toast:hover {
		background: #4338ca;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.empty {
		text-align: center;
		color: #64748b;
		margin-top: 40px;
	}
</style>
