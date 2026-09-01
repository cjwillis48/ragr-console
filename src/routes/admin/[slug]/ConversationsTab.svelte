<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import {
		deleteConversation,
		deleteMessage,
		getChunksByIds,
		getConversationMessages,
		getConversations
	} from '$lib/admin-api';
	import type { ChunkDetail, ConversationSummaryResponse, MessageResponse } from '$lib/admin-types';
	import { chunkRetrievalMethod, sortChunkRefs } from '$lib/admin-types';
	import { addToast } from '$lib/toast.svelte';

	const slug = $derived(page.params.slug!);

	let conversations = $state<ConversationSummaryResponse[]>([]);
	let conversationsTotal = $state(0);
	let expandedConversationId = $state<number | null>(null);
	let conversationMessages = $state<MessageResponse[]>([]);
	let loadingMessages = $state(false);

	// Retrieved chunks for one expanded message
	let expandedMsgId = $state<number | null>(null);
	let msgChunks = $state<ChunkDetail[]>([]);
	let loadingMsgChunks = $state(false);

	async function load() {
		try {
			const res = await getConversations(slug);
			conversations = res.conversations;
			conversationsTotal = res.total;
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to load conversations', 'error');
		}
	}

	onMount(() => {
		load();
	});

	async function handleDeleteMessage(convId: number, msgId: number) {
		if (!confirm('Delete this message?')) return;
		try {
			await deleteMessage(slug, convId, msgId);
			conversationMessages = conversationMessages.filter((m) => m.id !== msgId);
			if (expandedMsgId === msgId) {
				expandedMsgId = null;
				msgChunks = [];
			}
			addToast('Message deleted', 'success');
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to delete message', 'error');
		}
	}

	async function handleDeleteConversation(convId: number) {
		if (
			!confirm(
				'Hide this conversation? It will be removed from the UI but preserved in the database.'
			)
		)
			return;
		try {
			await deleteConversation(slug, convId);
			conversations = conversations.filter((c) => c.id !== convId);
			conversationsTotal--;
			if (expandedConversationId === convId) {
				expandedConversationId = null;
				conversationMessages = [];
			}
			addToast('Conversation hidden', 'success');
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to delete conversation', 'error');
		}
	}

	async function toggleConversation(convId: number) {
		if (expandedConversationId === convId) {
			expandedConversationId = null;
			conversationMessages = [];
			expandedMsgId = null;
			msgChunks = [];
			return;
		}
		expandedConversationId = convId;
		conversationMessages = [];
		expandedMsgId = null;
		msgChunks = [];
		loadingMessages = true;
		try {
			const detail = await getConversationMessages(slug, convId);
			conversationMessages = detail.messages;
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to load messages', 'error');
			expandedConversationId = null;
		} finally {
			loadingMessages = false;
		}
	}

	async function toggleMessageChunks(msg: MessageResponse) {
		if (expandedMsgId === msg.id) {
			expandedMsgId = null;
			msgChunks = [];
			return;
		}
		expandedMsgId = msg.id;
		msgChunks = [];
		if (!msg.retrieved_chunks?.length) return;
		loadingMsgChunks = true;
		try {
			const ids = msg.retrieved_chunks.map((c) => c.chunk_id);
			msgChunks = await getChunksByIds(slug, ids);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to load chunks', 'error');
			expandedMsgId = null;
		} finally {
			loadingMsgChunks = false;
		}
	}
</script>

{#if conversations.length === 0}
	<div class="text-sm text-text-muted">No conversations yet.</div>
{:else}
	<div class="mb-4 text-sm text-text-muted">{conversationsTotal} total conversation(s)</div>
	<div class="space-y-3">
		{#each conversations as conv}
			<div
				class="rounded-lg border border-border bg-surface-alt p-4 transition-colors hover:border-accent/50"
			>
				<div
					class="flex cursor-pointer items-center justify-between"
					role="button"
					tabindex="0"
					onclick={() => toggleConversation(conv.id)}
					onkeydown={(e) => {
						if (e.key === 'Enter') toggleConversation(conv.id);
					}}
				>
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium">{conv.title || 'Untitled'}</span>
						<span
							class="rounded border border-border bg-surface px-2 py-0.5 text-xs text-text-muted"
							>{conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}</span
						>
					</div>
					<div class="flex shrink-0 items-center gap-2 sm:gap-3">
						<span class="hidden font-mono text-xs text-text-muted sm:inline"
							>{conv.session_id.slice(0, 8)}...</span
						>
						<span class="hidden text-xs text-text-muted sm:inline"
							>{new Date(conv.updated_at).toLocaleString()}</span
						>
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								handleDeleteConversation(conv.id);
							}}
							class="text-xs text-text-muted hover:text-error">Delete</button
						>
						<span class="text-xs text-text-muted"
							>{expandedConversationId === conv.id ? '▲' : '▼'}</span
						>
					</div>
				</div>
			</div>
			{#if expandedConversationId === conv.id}
				<div class="ml-4 space-y-2">
					{#if loadingMessages}
						<div class="text-sm text-text-muted">Loading messages...</div>
					{:else if conversationMessages.length === 0}
						<div class="text-sm text-text-muted">No messages in this conversation.</div>
					{:else}
						{#each conversationMessages as msg}
							<div
								class="space-y-2 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-accent/50"
							>
								<div
									class="flex cursor-pointer items-center justify-between"
									role="button"
									tabindex="0"
									onclick={() => toggleMessageChunks(msg)}
									onkeydown={(e) => {
										if (e.key === 'Enter') toggleMessageChunks(msg);
									}}
								>
									<div class="flex items-center gap-2">
										<span
											class="rounded px-2 py-0.5 text-xs {msg.status === 'answered'
												? 'bg-green-500/20 text-green-400'
												: msg.status === 'off_topic'
													? 'bg-yellow-500/20 text-yellow-400'
													: 'bg-red-500/20 text-red-400'}">{msg.status}</span
										>
										{#if msg.retrieved_chunks?.length}
											<span class="text-[10px] text-text-muted"
												>{msg.retrieved_chunks.length} chunks</span
											>
										{/if}
									</div>
									<div class="flex items-center gap-2">
										<span class="text-xs text-text-muted"
											>{new Date(msg.created_at).toLocaleString()}</span
										>
										<button
											type="button"
											onclick={(e) => {
												e.stopPropagation();
												handleDeleteMessage(conv.id, msg.id);
											}}
											class="text-xs text-text-muted hover:text-error">Delete</button
										>
										<span class="text-xs text-text-muted"
											>{expandedMsgId === msg.id ? '▲' : '▼'}</span
										>
									</div>
								</div>
								<div class="select-text">
									<div class="text-sm font-medium">User: {msg.message}</div>
									<div class="mt-1 text-sm text-text-muted">Bot: {msg.response}</div>
								</div>
								<div class="text-xs text-text-muted">
									Tokens: {msg.tokens_in} in / {msg.tokens_out} out
								</div>
							</div>
							{#if expandedMsgId === msg.id}
								<div class="ml-4 space-y-2">
									{#if loadingMsgChunks}
										<div class="text-sm text-text-muted">Loading chunks...</div>
									{:else if !msg.retrieved_chunks?.length}
										<div class="text-sm text-text-muted">
											No chunks were retrieved for this message.
										</div>
									{:else if msgChunks.length === 0}
										<div class="text-sm text-text-muted">Chunk content unavailable.</div>
									{:else}
										{@const sortedRefs = sortChunkRefs(msg.retrieved_chunks)}
										<div class="mb-1 flex items-center justify-between">
											<span class="text-xs text-text-muted"
												>{msgChunks.length} retrieved chunk(s) — sorted by score</span
											>
										</div>
										{#each sortedRefs as ref}
											{@const chunk = msgChunks.find((c) => c.id === ref.chunk_id)}
											{@const method = chunkRetrievalMethod(ref)}
											{#if chunk}
												<div class="rounded-lg border border-border bg-surface-alt p-3">
													<div class="mb-1 flex items-center justify-between">
														<div class="flex items-center gap-2">
															<span class="font-mono text-[10px] text-text-muted">
																{chunk.source_identifier} &middot; {chunk.content_type}
															</span>
															<span
																class="rounded px-1.5 py-0.5 text-[10px] {method === 'keyword'
																	? 'bg-blue-500/20 text-blue-400'
																	: method === 'hybrid'
																		? 'bg-purple-500/20 text-purple-400'
																		: 'bg-emerald-500/20 text-emerald-400'}">{method}</span
															>
														</div>
														<span class="text-[10px] text-text-muted">
															dist: {ref.distance.toFixed(3)}{ref.rerank_score != null
																? ` · rerank: ${ref.rerank_score.toFixed(3)}`
																: ''}{ref.keyword_rank != null ? ` · kw: ${ref.keyword_rank}` : ''}
														</span>
													</div>
													<pre
														class="max-h-48 overflow-y-auto text-xs wrap-break-word whitespace-pre-wrap text-text">{chunk.content}</pre>
												</div>
											{/if}
										{/each}
									{/if}
								</div>
							{/if}
						{/each}
					{/if}
				</div>
			{/if}
		{/each}
	</div>
{/if}
