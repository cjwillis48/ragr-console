<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { fly, fade } from 'svelte/transition';
	import { streamChat } from '$lib/api';
	import type { Message } from '$lib/types';
	import { isNonAnswered, getStatusLabel, getStatusDescription, getStatusContainerClass, getStatusBadgeClass, getStatusDescriptionClass, renderMarkdown, getSuggestionsForMessage as _getSuggestions } from '$lib/chat-utils';

	interface Props {
		slug: string;
		name: string;
		description?: string;
		label?: string | null;
		greeting?: string | null;
		placeholder?: string;
		launcherHint?: string | null;
		acceptingRequests?: boolean;
		inline?: boolean;
		primaryColor?: string | null;
		bgColor?: string | null;
		textColor?: string | null;
		userBubbleColor?: string | null;
		botBubbleColor?: string | null;
		fontFamily?: string | null;
		borderRadius?: number | null;
		sampleQuestions?: string[];
		showSampleQuestionsInGreeting?: boolean;
	}

	let {
		slug, name, description, label, greeting = '', placeholder = 'Ask a question...',
		launcherHint, acceptingRequests = true, inline = false,
		primaryColor, bgColor, textColor, userBubbleColor, botBubbleColor, fontFamily, borderRadius,
		sampleQuestions = [],
		showSampleQuestionsInGreeting = true
	}: Props = $props();

	let subtitle = $derived(label?.trim() || '');

	let isOpen = $state(false);
	let messages = $state<Message[]>([]);
	let sessionId = crypto.randomUUID();
	let input = $state('');
	let isSending = $state(false);
	let errorMessage = $state('');
	let showLauncherHint = $state(false);
	let messagesContainer = $state<HTMLDivElement>();
	let chatInputEl = $state<HTMLTextAreaElement>();

	let panelWidth = $state(384);
	let panelHeight = $state(512);
	let isResizing = false;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartWidth = 0;
	let resizeStartHeight = 0;

	const MIN_PANEL_WIDTH = 320;
	const MIN_PANEL_HEIGHT = 384;
	const LAUNCHER_HINT_MS = 6500;
	let launcherHintTimeout: ReturnType<typeof setTimeout> | undefined;
	let abortController: AbortController | null = null;

	// Live-update the greeting message when greeting prop changes
	let prevGreeting = greeting;
	$effect(() => {
		if (greeting !== prevGreeting) {
			prevGreeting = greeting;
			const hasGreetingMsg = messages.length > 0 && messages[0].id === 'greeting';
			if (greeting?.trim()) {
				if (hasGreetingMsg) {
					messages[0] = { ...messages[0], content: greeting };
				} else {
					messages = [{ id: 'greeting', role: 'assistant', content: greeting, status: 'answered' }, ...messages];
				}
			} else if (hasGreetingMsg) {
				messages = messages.slice(1);
			}
		}
	});

	function clamp(value: number, min: number, max: number): number {
		return Math.min(Math.max(value, min), max);
	}

	function getMaxPanelSize() {
		const maxWidth = Math.max(MIN_PANEL_WIDTH, window.innerWidth - 32);
		const maxHeight = Math.max(MIN_PANEL_HEIGHT, Math.floor(window.innerHeight * 0.7));
		return { width: maxWidth, height: maxHeight };
	}

	function syncPanelSizeToViewport() {
		const { width, height } = getMaxPanelSize();
		panelWidth = clamp(panelWidth, MIN_PANEL_WIDTH, width);
		panelHeight = clamp(panelHeight, MIN_PANEL_HEIGHT, height);
	}

	function handleResizeMove(event: PointerEvent) {
		if (!isResizing) return;
		const deltaX = resizeStartX - event.clientX;
		const deltaY = resizeStartY - event.clientY;
		const { width, height } = getMaxPanelSize();
		panelWidth = clamp(resizeStartWidth + deltaX, MIN_PANEL_WIDTH, width);
		panelHeight = clamp(resizeStartHeight + deltaY, MIN_PANEL_HEIGHT, height);
	}

	function stopResize() { isResizing = false; }

	function handleResizeStart(event: PointerEvent) {
		if (window.innerWidth < 768) return;
		isResizing = true;
		resizeStartX = event.clientX;
		resizeStartY = event.clientY;
		resizeStartWidth = panelWidth;
		resizeStartHeight = panelHeight;
		event.preventDefault();
	}

	onMount(() => {
		syncPanelSizeToViewport();
		window.addEventListener('pointermove', handleResizeMove);
		window.addEventListener('pointerup', stopResize);
		window.addEventListener('pointercancel', stopResize);
		window.addEventListener('resize', syncPanelSizeToViewport);

		if (greeting?.trim()) {
			messages = [{
				id: 'greeting',
				role: 'assistant',
				content: greeting,
				status: 'answered'
			}];
		}

		showLauncherHint = true;
		launcherHintTimeout = setTimeout(() => { showLauncherHint = false; }, LAUNCHER_HINT_MS);
	});

	onDestroy(() => {
		if (launcherHintTimeout) clearTimeout(launcherHintTimeout);
		abortController?.abort();
		if (!browser) return;
		window.removeEventListener('pointermove', handleResizeMove);
		window.removeEventListener('pointerup', stopResize);
		window.removeEventListener('pointercancel', stopResize);
		window.removeEventListener('resize', syncPanelSizeToViewport);
	});

	async function scrollToBottom() {
		await tick();
		if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
	}

	async function focusInput() {
		await tick();
		chatInputEl?.focus();
	}

	async function sendMessage() {
		if (!acceptingRequests || isSending) return;
		const question = input.trim();
		if (!question) return;

		errorMessage = '';
		isSending = true;
		input = '';

		const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: question };
		const assistantId = crypto.randomUUID();
		const assistantMessage: Message = {
			id: assistantId, role: 'assistant', content: '', status: 'answered', isStreaming: true
		};

		messages = [...messages, userMessage, assistantMessage];
		await scrollToBottom();

		abortController = new AbortController();
		let finalContent = '';

		await streamChat(slug, question, sessionId, {
			onDelta(delta) {
				finalContent += delta;
				messages = messages.map((m) =>
					m.id === assistantId ? { ...m, content: m.content + delta } : m
				);
				scrollToBottom();
			},
			onDone(answer, status) {
				finalContent = answer;
				messages = messages.map((m) =>
					m.id === assistantId ? { ...m, content: answer, status, isStreaming: false } : m
				);
				isSending = false;
				abortController = null;
				scrollToBottom();
				focusInput();
			},
			onError(msg) {
				errorMessage = msg;
				messages = messages.map((m) =>
					m.id === assistantId
						? { ...m, content: m.content || msg, status: 'error', isStreaming: false }
						: m
				);
				isSending = false;
				abortController = null;
				scrollToBottom();
				focusInput();
			}
		}, abortController.signal);

		if (isSending) {
			isSending = false;
			abortController = null;
			focusInput();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
		if (event.key === 'Escape' && isOpen) {
			isOpen = false;
		}
	}

	function getSuggestionsForMessage(msg: Message, index: number): string[] {
		return _getSuggestions(msg, index, messages, sampleQuestions, showSampleQuestionsInGreeting);
	}

	function handleSuggestion(text: string) {
		if (isSending) return;
		input = text;
		sendMessage();
	}
</script>

{#if inline}
	{@const bg = bgColor ?? '#0f172a'}
	{@const text = textColor ?? '#e2e8f0'}
	{@const primary = primaryColor ?? '#6366f1'}
	{@const userBubble = userBubbleColor ?? '#4f46e5'}
	{@const botBubble = botBubbleColor ?? '#1e293b'}
	{@const font = fontFamily ?? 'inherit'}
	{@const radius = borderRadius ?? 12}
	<section
		class="flex flex-col overflow-hidden h-full"
		style="background: {bg}; color: {text}; font-family: {font}; border-radius: {radius}px;"
		aria-label="{name} assistant"
	>
		<!-- Header -->
		<header class="px-4 py-3 flex items-center gap-2" style="border-bottom: 1px solid color-mix(in srgb, {text} 20%, transparent);">
			<div>
				<p class="font-semibold">{name}</p>
				{#if subtitle}
					<p class="text-xs" style="opacity: 0.7;">{subtitle}</p>
				{/if}
			</div>
		</header>

		<!-- Messages -->
		<div bind:this={messagesContainer} class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
			{#each messages as msg, i (msg.id)}
				<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
					{#if msg.role === 'user'}
						<p class="max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap" style="background: {userBubble}; color: {text}; border-radius: {radius}px;">{msg.content}</p>
					{:else}
						<div class="max-w-[85%]">
							<div class="px-3 py-2 text-sm" style="background: {botBubble}; border-radius: {radius}px;">
								{#if isNonAnswered(msg.status)}
									<div class="mb-2 flex items-start gap-2">
										<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide {getStatusBadgeClass(msg.status)}" title={getStatusDescription(msg.status)}>
											<svg viewBox="0 0 16 16" class="h-3 w-3" fill="none" aria-hidden="true">
												<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" />
												<path d="M8 7.1v3.3M8 5.2h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
											</svg>
											{getStatusLabel(msg.status)}
										</span>
									</div>
									<p class="mb-2 text-[11px] leading-snug {getStatusDescriptionClass(msg.status)}">{getStatusDescription(msg.status)}</p>
								{/if}
								{#if msg.content}
									<div class="chat-markdown break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:underline [&_a]:break-all [&_code]:text-[0.95em] [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5">
										{@html renderMarkdown(msg.content)}
									</div>
								{:else if msg.isStreaming}
									<span style="opacity: 0.5;">Thinking...</span>
								{/if}
							</div>
							{#if getSuggestionsForMessage(msg, i).length > 0}
								<div class="mt-2 flex flex-wrap gap-1.5 justify-start">
									{#each getSuggestionsForMessage(msg, i) as suggestion}
										<button
											type="button"
											class="rounded-full px-2.5 py-1 text-[11px] leading-tight text-left transition-opacity hover:opacity-80"
											style="background: color-mix(in srgb, {text} 12%, {bg}); color: {text}; border: 1px solid color-mix(in srgb, {text} 20%, transparent);"
											onclick={() => handleSuggestion(suggestion)}
										>
											{suggestion}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Input -->
		<form class="p-3" style="border-top: 1px solid color-mix(in srgb, {text} 20%, transparent);" onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
			<label for="chat-panel-inline-input" class="sr-only">Ask a question</label>
			<div class="flex items-end gap-2">
				<textarea
					id="chat-panel-inline-input"
					bind:this={chatInputEl}
					bind:value={input}
					rows="2"
					maxlength="2000"
					placeholder={placeholder}
					class="min-h-[2.75rem] max-h-28 flex-1 resize-y px-3 py-2 text-sm focus:outline-none"
					style="background: color-mix(in srgb, {text} 10%, {bg}); color: {text}; border: 1px solid color-mix(in srgb, {text} 20%, transparent); border-radius: {radius}px;"
					onkeydown={handleKeydown}
				></textarea>
				<button
					type="submit"
					disabled={isSending || !input.trim()}
					class="h-11 px-4 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					style="background: {primary}; border-radius: {radius}px;"
				>
					{isSending ? '...' : 'Send'}
				</button>
			</div>
			{#if errorMessage}
				<p class="mt-2 text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
			{/if}
		</form>
	</section>
{:else if acceptingRequests}
	<div
		in:fly={{ x: 96, duration: 320, opacity: 0 }}
		class="fixed right-4 bottom-4 z-40"
	>
		{#if isOpen}
			<section
				class="relative flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden dark:bg-slate-900 dark:border-slate-700"
				style="width: {panelWidth}px; height: {panelHeight}px; max-width: calc(100vw - 2rem); max-height: 70vh;"
				aria-label="{name} assistant"
			>
				<!-- Resize handle -->
				<button
					type="button"
					class="hidden md:flex absolute top-0 left-0 h-6 w-6 items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-nwse-resize z-10"
					onpointerdown={handleResizeStart}
					aria-label="Resize chat window"
				>
					<svg viewBox="0 0 16 16" class="h-3.5 w-3.5" fill="none" aria-hidden="true">
						<path d="M3 13L13 3M8 13L13 8M3 8L8 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
					</svg>
				</button>

				<!-- Header -->
				<header class="px-4 py-3 border-b border-slate-200 bg-slate-50 dark:bg-slate-800/70 dark:border-slate-700 flex items-center justify-between gap-2">
					<div>
						<p class="font-semibold text-slate-900 dark:text-slate-100">{name}</p>
						{#if subtitle}
							<p class="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
						{/if}
					</div>
					<button
						class="text-sm px-2 py-1 rounded-md text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
						onclick={() => (isOpen = false)}
						aria-label="Close chat"
					>
						Close
					</button>
				</header>

				<!-- Messages -->
				<div bind:this={messagesContainer} class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 bg-white dark:bg-slate-900">
					{#each messages as msg, i (msg.id)}
						<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
							{#if msg.role === 'user'}
								<p class="max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap bg-indigo-600 text-white">{msg.content}</p>
							{:else}
								<div class="max-w-[85%]">
									<div class="rounded-2xl px-3 py-2 text-sm {isNonAnswered(msg.status) ? getStatusContainerClass(msg.status) : getStatusContainerClass(undefined)}">
										{#if isNonAnswered(msg.status)}
											<div class="mb-2 flex items-start gap-2">
												<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide {getStatusBadgeClass(msg.status)}" title={getStatusDescription(msg.status)}>
													<svg viewBox="0 0 16 16" class="h-3 w-3" fill="none" aria-hidden="true">
														<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" />
														<path d="M8 7.1v3.3M8 5.2h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
													</svg>
													{getStatusLabel(msg.status)}
												</span>
											</div>
											<p class="mb-2 text-[11px] leading-snug {getStatusDescriptionClass(msg.status)}">{getStatusDescription(msg.status)}</p>
										{/if}
										{#if msg.content}
											<div class="chat-markdown break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:underline [&_a]:break-all [&_code]:text-[0.95em] [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5">
												{@html renderMarkdown(msg.content)}
											</div>
										{:else if msg.isStreaming}
											<span class="text-slate-500 dark:text-slate-400">Thinking...</span>
										{/if}
									</div>
									{#if getSuggestionsForMessage(msg, i).length > 0}
										<div class="mt-2 flex flex-wrap gap-1.5">
											{#each getSuggestionsForMessage(msg, i) as suggestion}
												<button
													type="button"
													class="rounded-full border border-slate-300/80 bg-white/80 px-2.5 py-1 text-[11px] leading-tight text-slate-700 hover:bg-white dark:border-slate-500/60 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
													onclick={() => handleSuggestion(suggestion)}
												>
													{suggestion}
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Input -->
				<form class="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
					<label for="chat-panel-input" class="sr-only">Ask a question</label>
					<div class="flex items-end gap-2">
						<textarea
							id="chat-panel-input"
							bind:this={chatInputEl}
							bind:value={input}
							rows="2"
							maxlength="2000"
							placeholder={placeholder}
							class="min-h-[2.75rem] max-h-28 flex-1 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-900/40"
							onkeydown={handleKeydown}
						></textarea>
						<button
							type="submit"
							disabled={isSending || !input.trim()}
							class="h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isSending ? '...' : 'Send'}
						</button>
					</div>
					{#if errorMessage}
						<p class="mt-2 text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
					{/if}
				</form>
			</section>
		{:else}
			<div class="flex flex-col items-end gap-2">
				{#if showLauncherHint && launcherHint?.trim()}
					<div
						in:fly={{ x: 56, duration: 260, opacity: 0 }}
						out:fade={{ duration: 300 }}
						class="rounded-xl bg-white/95 border border-slate-200 px-3 py-2 text-xs text-slate-700 shadow-md dark:bg-slate-900/95 dark:border-slate-700 dark:text-slate-200"
					>
						{launcherHint}
					</div>
				{/if}
				<button
					in:fly={{ x: 72, duration: 300, opacity: 0 }}
					class="inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-500 transition-all duration-200 hover:scale-[1.02] active:scale-95"
					onclick={() => { isOpen = true; showLauncherHint = false; focusInput(); }}
					aria-label="Open chat assistant"
					title="Open {name}"
				>
					<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M8 10h8M8 14h5M12 3C7.03 3 3 6.58 3 11c0 2.02.84 3.87 2.23 5.29L5 21l4.08-1.91c.92.25 1.9.38 2.92.38 4.97 0 9-3.58 9-8s-4.03-8.47-9-8.47z"
							stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
						/>
					</svg>
				</button>
			</div>
		{/if}
	</div>
{/if}
