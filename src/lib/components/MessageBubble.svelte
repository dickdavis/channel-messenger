<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';

	let { content, role, createdAt }: { content: string; role: 'user' | 'assistant'; createdAt: string } = $props();
</script>

<div class="message {role}">
	<div class="bubble">
		<div class="markdown">{@html DOMPurify.sanitize(marked.parse(content) as string)}</div>
		<time>{new Date(createdAt.endsWith('Z') ? createdAt : createdAt + 'Z').toLocaleTimeString()}</time>
	</div>
</div>

<style>
	.message {
		display: flex;
	}

	.message.user {
		justify-content: flex-end;
	}

	.message.assistant {
		justify-content: flex-start;
	}

	.bubble {
		max-width: 70%;
		padding: 8px 12px;
		border-radius: var(--radius-lg);
		word-wrap: break-word;
	}

	.message.user .bubble {
		background: var(--color-primary);
		color: #fff;
	}

	.message.assistant .bubble {
		background: var(--color-bg-raised);
		color: var(--color-text);
	}

	.markdown :global(p) {
		margin: 0 0 8px;
	}

	.markdown :global(p:last-child) {
		margin-bottom: 0;
	}

	.markdown :global(pre) {
		background: var(--color-bg-deep);
		color: #d4d4d4;
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		overflow-x: auto;
		font-size: var(--text-base);
	}

	.markdown :global(code) {
		background: rgba(255, 255, 255, 0.1);
		padding: 1px 4px;
		border-radius: var(--radius-xs);
		font-size: 0.85em;
	}

	.markdown :global(pre code) {
		background: none;
		padding: 0;
	}

	.markdown :global(ul),
	.markdown :global(ol) {
		margin: 4px 0;
		padding-left: 20px;
	}

	.markdown :global(li) {
		margin: 2px 0;
	}

	.markdown :global(blockquote) {
		margin: 4px 0;
		padding-left: 10px;
		border-left: 3px solid var(--color-text-dim);
		color: var(--color-text-muted);
	}

	.markdown :global(table) {
		border-collapse: collapse;
		width: 100%;
		margin: 8px 0;
		font-size: 0.85em;
	}

	.markdown :global(th),
	.markdown :global(td) {
		border: 1px solid var(--color-bg-raised);
		padding: 6px 10px;
		text-align: left;
	}

	.markdown :global(th) {
		background: rgba(255, 255, 255, 0.05);
		font-weight: 600;
	}

	.markdown :global(tr:nth-child(even)) {
		background: rgba(255, 255, 255, 0.02);
	}

	.markdown :global(ul:has(input[type='checkbox'])) {
		list-style: none;
		padding-left: 4px;
	}

	.markdown :global(input[type='checkbox']) {
		margin-right: 6px;
	}

	.markdown :global(a) {
		color: var(--color-primary-light);
	}

	.markdown :global(a:hover) {
		color: var(--color-primary-lighter);
	}

	.bubble time {
		display: block;
		font-size: var(--text-xs);
		color: var(--color-text-muted);
		margin-top: 4px;
		text-align: right;
	}

	.message.user .bubble time {
		color: rgba(255, 255, 255, 0.6);
	}
</style>
