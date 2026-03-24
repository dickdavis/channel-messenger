<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';

	let { content, role, createdAt }: { content: string; role: 'user' | 'assistant'; createdAt: string } = $props();
</script>

<div class="message {role}">
	<div class="bubble">
		<div class="markdown">{@html DOMPurify.sanitize(marked.parse(content) as string)}</div>
		<time>{new Date(createdAt + 'Z').toLocaleTimeString()}</time>
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
		border-radius: 8px;
		word-wrap: break-word;
	}

	.message.user .bubble {
		background: #4f46e5;
		color: #fff;
	}

	.message.assistant .bubble {
		background: rgb(51 65 85);
		color: #f4f4f5;
	}

	.markdown :global(p) {
		margin: 0 0 8px;
	}

	.markdown :global(p:last-child) {
		margin-bottom: 0;
	}

	.markdown :global(pre) {
		background: rgb(15 23 42);
		color: #d4d4d4;
		padding: 8px 10px;
		border-radius: 4px;
		overflow-x: auto;
		font-size: 0.85rem;
	}

	.markdown :global(code) {
		background: rgba(255, 255, 255, 0.1);
		padding: 1px 4px;
		border-radius: 3px;
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
		border-left: 3px solid #64748b;
		color: #94a3b8;
	}

	.markdown :global(table) {
		border-collapse: collapse;
		width: 100%;
		margin: 8px 0;
		font-size: 0.85em;
	}

	.markdown :global(th),
	.markdown :global(td) {
		border: 1px solid rgb(51 65 85);
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
		color: #818cf8;
	}

	.markdown :global(a:hover) {
		color: #a5b4fc;
	}

	.bubble time {
		display: block;
		font-size: 0.7rem;
		color: #94a3b8;
		margin-top: 4px;
		text-align: right;
	}

	.message.user .bubble time {
		color: rgba(255, 255, 255, 0.6);
	}
</style>
