<script lang="ts">
	import { page } from '$app/state';
	import { onMount, tick } from 'svelte';
	import { fetchModelInfo, fetchTheme, streamChat } from '$lib/api';
	import type { ModelInfo, WidgetTheme, Message } from '$lib/types';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';

	type PageStatus = 'loading' | 'ready' | 'not_found' | 'error';

	let modelInfo = $state<ModelInfo | null>(null);
	let theme = $state<WidgetTheme>({});
	let messages = $state<Message[]>([]);
	let isStreaming = $state(false);
	let error = $state<string | null>(null);
	let pageStatus = $state<PageStatus>('loading');
	let messagesContainer = $state<HTMLDivElement>();
	let abortController: AbortController | null = null;
	let sessionId = crypto.randomUUID();

	const slug = $derived(page.params.slug!);

	let canSend = $derived(!isStreaming && pageStatus === 'ready' && modelInfo?.accepting_requests);
	let sampleQuestions = $derived(modelInfo?.sample_questions ?? []);

	async function scrollToBottom() {
		await tick();
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	$effect(() => {
		messages;
		scrollToBottom();
	});

	onMount(() => {
		loadModel();
		return () => { abortController?.abort(); };
	});

	async function loadModel() {
		pageStatus = 'loading';
		error = null;
		try {
			const [info, themeData] = await Promise.all([
				fetchModelInfo(slug),
				fetchTheme(slug)
			]);
			modelInfo = info;
			theme = themeData;
			if (theme.greeting?.trim()) {
				messages = [{
					id: crypto.randomUUID(),
					role: 'assistant',
					content: theme.greeting,
					status: 'answered'
				}];
			}
			pageStatus = 'ready';
		} catch (err: unknown) {
			if (err instanceof Error && err.message === 'not_found') {
				pageStatus = 'not_found';
			} else {
				pageStatus = 'error';
				error = err instanceof Error ? err.message : 'Failed to load model';
			}
		}
	}

	async function handleSend(text: string) {
		if (!modelInfo || !canSend) return;

		error = null;
		const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: text };
		const assistantId = crypto.randomUUID();
		const assistantMessage: Message = {
			id: assistantId,
			role: 'assistant',
			content: '',
			status: 'answered',
			isStreaming: true
		};

		messages = [...messages, userMessage, assistantMessage];
		isStreaming = true;
		abortController = new AbortController();

		await streamChat(slug, text, sessionId, {
			onDelta(delta) {
				messages = messages.map((m) =>
					m.id === assistantId ? { ...m, content: m.content + delta } : m
				);
			},
			onDone(answer, status) {
				messages = messages.map((m) =>
					m.id === assistantId ? { ...m, content: answer, status, isStreaming: false } : m
				);
				isStreaming = false;
				abortController = null;
			},
			onError(msg) {
				messages = messages.map((m) =>
					m.id === assistantId
						? { ...m, content: m.content || msg, status: 'error', isStreaming: false }
						: m
				);
				error = msg;
				isStreaming = false;
				abortController = null;
			}
		}, abortController.signal);
	}

	function handleSuggestion(text: string) {
		if (!isStreaming) handleSend(text);
	}

	function getSuggestionsForMessage(msg: Message, index: number): string[] {
		if (sampleQuestions.length === 0) return [];
		// Show on greeting (first message, no user messages yet)
		if (index === messages.length - 1 && msg.role === 'assistant' && msg.status === 'answered' && messages.every(m => m.role === 'assistant')) {
			return sampleQuestions;
		}
		// Show on first off_topic only
		if (msg.status === 'off_topic' && !msg.isStreaming) {
			const isFirstOffTopic = messages.findIndex(m => m.status === 'off_topic') === index;
			if (isFirstOffTopic) return sampleQuestions;
		}
		return [];
	}
</script>

<svelte:head>
	<title>{modelInfo?.name ?? 'Chat'}</title>
</svelte:head>

<div class="flex flex-col h-dvh bg-white dark:bg-slate-900">
	{#if pageStatus === 'loading'}
		<div class="flex items-center justify-center flex-1 text-slate-500 dark:text-slate-400">
			Loading...
		</div>
	{:else if pageStatus === 'not_found'}
		<div class="flex flex-col items-center justify-center flex-1 gap-2">
			<div class="text-xl font-medium text-slate-900 dark:text-slate-100">Model not found</div>
			<div class="text-slate-500 dark:text-slate-400">The model "{slug}" doesn't exist.</div>
		</div>
	{:else if pageStatus === 'error'}
		<div class="flex flex-col items-center justify-center flex-1 gap-3">
			<div class="text-xl font-medium text-slate-900 dark:text-slate-100">Something went wrong</div>
			<div class="text-slate-500 dark:text-slate-400">{error}</div>
			<button onclick={loadModel} class="text-indigo-600 hover:underline dark:text-indigo-400">Try again</button>
		</div>
	{:else}
		<!-- Header -->
		<header class="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-4 py-3 shrink-0">
			<div class="max-w-3xl mx-auto">
				<h1 class="font-semibold text-slate-900 dark:text-slate-100">{modelInfo?.name}</h1>
				{#if modelInfo?.description}
					<p class="text-xs text-slate-500 dark:text-slate-400">{modelInfo.description}</p>
				{/if}
			</div>
		</header>

		<!-- Messages -->
		<div bind:this={messagesContainer} class="flex-1 min-h-0 overflow-y-auto px-4 py-3 bg-white dark:bg-slate-900">
			<div class="max-w-3xl mx-auto space-y-3">
				{#each messages as msg, i (msg.id)}
					<ChatMessage
						role={msg.role}
						content={msg.content}
						status={msg.status}
						isStreaming={msg.isStreaming}
						modelName={msg.role === 'assistant' ? modelInfo?.name : undefined}
						suggestions={getSuggestionsForMessage(msg, i)}
						onsuggestion={handleSuggestion}
					/>
				{/each}
			</div>
		</div>

		<!-- Error bar -->
		{#if error}
			<div class="bg-rose-50 dark:bg-rose-500/10 border-t border-rose-200 dark:border-rose-500/30 px-4 py-2 text-center text-xs text-rose-600 dark:text-rose-400 shrink-0">
				{error}
			</div>
		{/if}

		<!-- Unavailable notice -->
		{#if modelInfo && !modelInfo.accepting_requests}
			<div class="border-t border-slate-200 dark:border-slate-700 px-4 py-3 text-center text-sm text-slate-500 dark:text-slate-400 shrink-0">
				This assistant is currently unavailable.
			</div>
		{/if}

		<!-- Input -->
		<ChatInput
			placeholder={theme.placeholder ?? 'Type a message...'}
			disabled={!canSend}
			onsend={handleSend}
		/>
	{/if}
</div>
