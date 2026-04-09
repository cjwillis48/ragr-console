<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { onMount, onDestroy, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { fetchModelInfo, fetchTheme, streamChat } from '$lib/api';
	import type { ModelInfo, WidgetTheme, Message } from '$lib/types';
	import { isNonAnswered, getStatusLabel, getStatusDescription, getStatusBadgeClass, getStatusDescriptionClass, renderMarkdown, getSuggestionsForMessage as _getSuggestions } from '$lib/chat-utils';

	const alwaysOpen = $derived(page.url.searchParams.has('expanded'));
	let isOpen = $state(false);
	let isChatAvailable = $state(false);
	let modelInfo = $state<ModelInfo | null>(null);
	let theme = $state<WidgetTheme>({});
	let messages = $state<Message[]>([]);
	let sessionId = crypto.randomUUID();
	let input = $state('');
	let isSending = $state(false);
	let errorMessage = $state('');
	let showLauncherHint = $state(false);
	let messagesContainer = $state<HTMLDivElement>();
	let chatInputEl = $state<HTMLTextAreaElement>();

	let panelWidth = $state(420);
	let panelHeight = $state(620);
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
	let sampleQuestions = $state<string[]>([]);
	const slug = $derived(page.params.slug!);

	function clamp(value: number, min: number, max: number): number {
		return Math.min(Math.max(value, min), max);
	}

	function handleResizeMove(event: PointerEvent) {
		if (!isResizing) return;
		const deltaX = resizeStartX - event.clientX;
		const deltaY = resizeStartY - event.clientY;
		panelWidth = clamp(resizeStartWidth + deltaX, MIN_PANEL_WIDTH, 600);
		panelHeight = clamp(resizeStartHeight + deltaY, MIN_PANEL_HEIGHT, 800);
	}

	function stopResize() { if (isResizing) { isResizing = false; postWidgetSize(); } }

	function handleResizeStart(event: PointerEvent) {
		if (window.innerWidth < 768) return;
		isResizing = true;
		resizeStartX = event.clientX;
		resizeStartY = event.clientY;
		resizeStartWidth = panelWidth;
		resizeStartHeight = panelHeight;
		event.preventDefault();
	}

	onMount(async () => {
		window.addEventListener('pointermove', handleResizeMove);
		window.addEventListener('pointerup', stopResize);
		window.addEventListener('pointercancel', stopResize);

		try {
			const [info, themeData] = await Promise.all([
				fetchModelInfo(slug),
				fetchTheme(slug)
			]);
			modelInfo = info;
			theme = themeData;
			sampleQuestions = info.sample_questions ?? [];
			isChatAvailable = info.accepting_requests;
			if (!isChatAvailable) return;

			if (theme.greeting?.trim()) {
				messages = [{
					id: crypto.randomUUID(),
					role: 'assistant',
					content: theme.greeting,
					status: 'answered'
				}];
			}

			if (alwaysOpen) {
				isOpen = true;
			} else {
				showLauncherHint = true;
				postWidgetSize();
				launcherHintTimeout = setTimeout(() => { showLauncherHint = false; postWidgetSize(); }, LAUNCHER_HINT_MS);
			}
		} catch {
			isChatAvailable = false;
		}
	});

	onDestroy(() => {
		if (launcherHintTimeout) clearTimeout(launcherHintTimeout);
		abortController?.abort();
		if (!browser) return;
		window.removeEventListener('pointermove', handleResizeMove);
		window.removeEventListener('pointerup', stopResize);
		window.removeEventListener('pointercancel', stopResize);
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
		if (!isChatAvailable || isSending) return;
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

		// If stream ended without done event
		if (isSending) {
			isSending = false;
			abortController = null;
			focusInput();
		}
	}

	function handleSuggestion(text: string) {
		if (isSending) return;
		input = text;
		sendMessage();
	}

	function getSuggestionsForMessage(msg: Message, index: number): string[] {
		return _getSuggestions(msg, index, messages, sampleQuestions, theme.show_sample_questions_in_greeting ?? true);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
		if (event.key === 'Escape' && isOpen) {
			isOpen = false;
			postWidgetSize();
		}
	}


	let bg = $derived(theme.bg_color ?? '#0f172a');
	let txt = $derived(theme.text_color ?? '#e2e8f0');
	let primary = $derived(theme.primary_color ?? '#6366f1');
	let userBubble = $derived(theme.user_bubble_color ?? '#4f46e5');
	let botBubble = $derived(theme.bot_bubble_color ?? '#1e293b');
	let font = $derived(theme.font_family ?? 'inherit');
	let radius = $derived(theme.border_radius ?? 12);
	let borderColor = $derived(`color-mix(in srgb, ${txt} 20%, transparent)`);
	let label = $derived(theme.label?.trim() || '');
	let hint = $derived(theme.launcher_hint?.trim() || '');

	// Notify parent frame of widget size so loader.js can resize the iframe
	let resizeTimer: ReturnType<typeof setTimeout> | undefined;

	function postWidgetSize() {
		if (alwaysOpen || typeof window === 'undefined') return;
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => {
			let width = 80;
			let height = 80;
			if (isOpen) {
				width = panelWidth + 32;
				height = panelHeight + 32;
			} else if (showLauncherHint && hint) {
				width = 350;
				height = 120;
			}
			try {
				window.parent?.postMessage({ type: 'ragr-widget-resize', width, height }, '*');
			} catch {
				// cross-origin postMessage may fail silently
			}
		}, 16);
	}
</script>

<svelte:head>
	<title>{modelInfo?.name ?? 'Chat'}</title>
	{#if theme.font_family}
		<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={theme.font_family.replace(/ /g, '+')}&display=swap" />
	{/if}
	<style>
		html, body {{ background: transparent !important; margin: 0; padding: 0; overflow: hidden; }}
	</style>
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && isOpen) { isOpen = false; postWidgetSize(); } }} />

{#if isChatAvailable}
	<div
		in:fly={{ x: alwaysOpen ? 0 : 96, duration: alwaysOpen ? 0 : 320, opacity: alwaysOpen ? 1 : 0 }}
		class="{alwaysOpen ? 'w-full h-dvh' : 'fixed right-4 bottom-4 z-40'}"
		style="font-family: {font};"
	>
		{#if isOpen}
			<section
				class="relative flex flex-col {alwaysOpen ? 'w-full h-full' : 'shadow-2xl'} overflow-hidden"
				style="{alwaysOpen ? '' : `width: ${panelWidth}px; height: ${panelHeight}px; max-width: 100vw; max-height: 100dvh;`} background: {bg}; color: {txt}; border-radius: {alwaysOpen ? 0 : radius}px; border: {alwaysOpen ? 'none' : `1px solid ${borderColor}`};"
				aria-label="{modelInfo?.name ?? 'Chat'} assistant"
			>
				<!-- Resize handle -->
				{#if !alwaysOpen}
				<button
					type="button"
					class="hidden md:flex absolute top-0 left-0 h-8 w-8 items-center justify-center cursor-nwse-resize z-10 hover:opacity-100 transition-opacity"
					style="color: {txt}; opacity: 0.5;"
					onpointerdown={handleResizeStart}
					aria-label="Resize chat window"
				>
					<svg viewBox="0 0 16 16" class="h-3.5 w-3.5" fill="none" aria-hidden="true">
						<path d="M3 13L13 3M8 13L13 8M3 8L8 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
					</svg>
				</button>
				{/if}

				<!-- Header -->
				<header class="px-4 py-3 flex items-center justify-between gap-2" style="border-bottom: 1px solid {borderColor};">
					<div>
						<p class="font-semibold">{modelInfo?.name}</p>
						{#if label}
							<p class="text-xs" style="opacity: 0.7;">{label}</p>
						{/if}
					</div>
					{#if !alwaysOpen}
					<button
						class="text-sm px-2 py-1 rounded-md"
						style="opacity: 0.7;"
						onclick={() => { isOpen = false; postWidgetSize(); }}
						aria-label="Close chat"
					>
						Close
					</button>
				{/if}
				</header>

				<!-- Messages -->
				<div bind:this={messagesContainer} class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
					{#each messages as msg, i (msg.id)}
						<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
							{#if msg.role === 'user'}
								<p class="max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap" style="background: {userBubble}; color: {txt}; border-radius: {radius}px;">{msg.content}</p>
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
											<div class="chat-markdown wrap-break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:underline [&_a]:break-all [&_code]:text-[0.95em] [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5">
												{@html renderMarkdown(msg.content)}
											</div>
										{:else if msg.isStreaming}
											<span style="opacity: 0.5;">Thinking...</span>
										{/if}
									</div>
									{#if getSuggestionsForMessage(msg, i).length > 0}
										<div class="mt-2 flex flex-wrap gap-1.5">
											{#each getSuggestionsForMessage(msg, i) as suggestion}
												<button
													type="button"
													class="rounded-full px-2.5 py-1 text-[11px] leading-tight text-left transition-opacity hover:opacity-80"
													style="background: color-mix(in srgb, {txt} 12%, {bg}); color: {txt}; border: 1px solid color-mix(in srgb, {txt} 20%, transparent);"
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
				<form class="p-3" style="border-top: 1px solid {borderColor};" onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
					<label for="embed-chat-input" class="sr-only">Ask a question</label>
					<div class="flex items-end gap-2">
						<textarea
							id="embed-chat-input"
							bind:this={chatInputEl}
							bind:value={input}
							rows="2"
							maxlength="2000"
							placeholder={theme.placeholder ?? 'Ask a question...'}
							class="min-h-11 max-h-28 flex-1 resize-y px-3 py-2 text-sm focus:outline-none"
							style="background: color-mix(in srgb, {txt} 10%, {bg}); color: {txt}; border: 1px solid {borderColor}; border-radius: {radius}px;"
							onkeydown={handleKeydown}
							onfocus={() => { try { window.parent?.postMessage({ type: 'ragr-widget-scroll-lock' }, '*'); } catch {} }}
							onblur={() => { try { window.parent?.postMessage({ type: 'ragr-widget-scroll-unlock' }, '*'); } catch {} }}
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
						<p class="mt-2 text-xs text-red-600">{errorMessage}</p>
					{/if}
				</form>
			</section>
		{:else}
			<div class="flex flex-col items-end gap-2">
				{#if showLauncherHint && hint}
					<div
						in:fly={{ x: 56, duration: 260, opacity: 0 }}
						out:fly={{ x: 80, duration: 600, opacity: 0 }}
						class="rounded-xl px-3 py-2 text-xs shadow-md"
						style="background: {bg}; color: {txt}; border: 1px solid {borderColor};"
					>
						{hint}
					</div>
				{/if}
				<button
					in:fly={{ x: 72, duration: 300, opacity: 0 }}
					class="inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-95"
					style="background: {primary};"
					onclick={() => { isOpen = true; showLauncherHint = false; postWidgetSize(); focusInput(); }}
					aria-label="Open chat assistant"
					title="Open {modelInfo?.name ?? 'Chat'}"
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
