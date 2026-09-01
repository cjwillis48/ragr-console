<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import {
		acceptGeneratedPrompt,
		crawlSite,
		createSource,
		deleteAllSources,
		deleteSource,
		reingestSource,
		reingestAllSources,
		generateSampleMessages,
		getModel,
		getSourceChunks,
		getSources,
		getSystemPromptHistory,
		rollbackSystemPrompt,
		streamGenerateSystemPrompt,
		updateModel,
		uploadSources,
		upsertSource
	} from '$lib/admin-api';
	import type {
		ChunkDetail,
		ChunkListResponse,
		CreateSourceRequest,
		RagModel,
		RagModelUpdate,
		SourceResponse,
		SystemPromptHistoryEntry
	} from '$lib/admin-types';
	import { addToast } from '$lib/toast.svelte';
	import { currentUser } from '$lib/current-user.svelte';
	import ApiKeysTab from './ApiKeysTab.svelte';
	import ConversationsTab from './ConversationsTab.svelte';
	import StatsTab from './StatsTab.svelte';
	import WidgetTab from './WidgetTab.svelte';

	const slug = $derived(page.params.slug!);

	type Tab = 'settings' | 'widget' | 'sources' | 'conversations' | 'api-keys' | 'stats';

	let model = $state<RagModel | null>(null);
	let sources = $state<SourceResponse[]>([]);
	let sourcesTotal = $state(0);
	let sourcesOffset = $state(0);
	let sourcesSearch = $state('');
	let sourcesSearchTimer: ReturnType<typeof setTimeout> | undefined;
	const SOURCES_PER_PAGE = 50;

	// Locks chunk-size / chunk-overlap / embedding-model controls. `model.has_content` is
	// the server's view at load time; `sourcesTotal > 0` covers sources added in this
	// session before the model is reloaded. Without the OR, those controls would stay
	// enabled until refresh after the first source is added.
	const hasContent = $derived(!!model?.has_content || sourcesTotal > 0);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let saveSuccess = $state(false);
	const validTabs: Tab[] = ['settings', 'widget', 'sources', 'conversations', 'api-keys', 'stats'];
	function getInitialTab(): Tab {
		if (typeof window === 'undefined') return 'settings';
		const hash = window.location.hash.slice(1) as Tab;
		return validTabs.includes(hash) ? hash : 'settings';
	}
	let activeTab = $state<Tab>(getInitialTab());
	let saving = $state(false);

	// API key inputs (never populated from GET — write-only)
	let anthropicKeyInput = $state('');
	let voyageKeyInput = $state('');

	// System prompt magic generation
	let generatingPrompt = $state(false);
	let generatedPrompt = $state('');
	let generationInput = $state('');
	let showGeneratedPreview = $state(false);
	let promptHistory = $state<SystemPromptHistoryEntry[]>([]);
	let showPromptHistory = $state(false);
	let generatingSampleQuestions = $state(false);
	let newSampleQuestion = $state('');

	// Source add form
	let sourceType = $state<'url' | 'text' | 'upload'>('url');
	let crawlEnabled = $state(false);
	let crawlMaxPages = $state(50);
	let crawlMaxDepth = $state(3);
	let crawling = $state(false);
	let sourceUrlText = $state('');
	let parsedUrls = $derived(
		sourceUrlText
			.split('\n')
			.map((u) => u.trim())
			.filter((u) => u.length > 0)
	);
	let sourceText = $state('');
	let sourceIdentifier = $state('');
	let addingSource = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let sourcePollTimer: ReturnType<typeof setInterval> | null = null;
	// Statuses the backend never moves off on its own — anything else means
	// work is still in flight and the poll must keep going.
	const TERMINAL_SOURCE_STATUSES = new Set(['complete', 'error', 'failed']);

	function setSourceType(key: string) {
		sourceType = key as typeof sourceType;
	}

	// Chunks viewer
	let chunksData = $state<ChunkListResponse | null>(null);
	let chunksSourceId = $state<number | null>(null);
	let loadingChunks = $state(false);

	onMount(() => {
		loadModel().then(() => {
			if (activeTab !== 'settings') loadTab(activeTab);
		});
		return () => {
			stopSourcePolling();
		};
	});

	function startSourcePolling(keepAlive = false) {
		stopSourcePolling();
		let stableCount = 0;
		let lastTotal = 0;
		sourcePollTimer = setInterval(async () => {
			try {
				const res = await getSources(slug, SOURCES_PER_PAGE, sourcesOffset, sourcesSearch);
				sources = res.sources;
				sourcesTotal = res.total;
				const allDone = sources.every((s) => TERMINAL_SOURCE_STATUSES.has(s.status));
				if (allDone && !keepAlive) {
					stopSourcePolling();
				} else if (allDone && keepAlive) {
					// During crawl: stop after source count stabilizes for 10 consecutive polls
					if (sources.length === lastTotal) {
						stableCount++;
						if (stableCount >= 10) stopSourcePolling();
					} else {
						lastTotal = sources.length;
						stableCount = 0;
					}
				}
			} catch {
				/* ignore polling errors */
			}
		}, 1000);
	}

	function stopSourcePolling() {
		if (sourcePollTimer) {
			clearInterval(sourcePollTimer);
			sourcePollTimer = null;
		}
	}

	async function loadModel() {
		loading = true;
		loadError = null;
		try {
			model = await getModel(slug);
		} catch (e: unknown) {
			loadError = e instanceof Error ? e.message : 'Failed to load model';
		} finally {
			loading = false;
		}
	}

	async function loadTab(tab: Tab) {
		activeTab = tab;
		window.location.hash = tab;
		if (tab !== 'sources') stopSourcePolling();
		try {
			if (tab === 'sources') {
				sourcesOffset = 0;
				sourcesSearch = '';
				const res = await getSources(slug, SOURCES_PER_PAGE, 0);
				sources = res.sources;
				sourcesTotal = res.total;
			}
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to load data', 'error');
		}
	}

	async function handleGeneratePrompt() {
		if (!model) return;
		generatingPrompt = true;
		generatedPrompt = '';
		generationInput = model.system_prompt || '';
		showGeneratedPreview = true;
		try {
			await streamGenerateSystemPrompt(
				slug,
				model.system_prompt || '',
				(token) => {
					generatedPrompt += token;
				},
				() => {
					generatingPrompt = false;
				},
				(err) => {
					addToast(err, 'error');
					generatingPrompt = false;
				}
			);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Generation failed', 'error');
			generatingPrompt = false;
		}
	}

	async function handleAcceptGenerated() {
		if (!model || !generatedPrompt) return;
		try {
			await acceptGeneratedPrompt(slug, generatedPrompt, generationInput);
			model.system_prompt = generatedPrompt;
			showGeneratedPreview = false;
			generatedPrompt = '';
			addToast('System prompt updated', 'success');
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to accept prompt', 'error');
		}
	}

	async function handleLoadPromptHistory() {
		showPromptHistory = !showPromptHistory;
		if (!showPromptHistory) return;
		try {
			promptHistory = await getSystemPromptHistory(slug);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to load history', 'error');
		}
	}

	async function handleRollbackPrompt(entry: SystemPromptHistoryEntry) {
		if (!model) return;
		if (!confirm('Restore this system prompt? The current prompt will be saved to history.'))
			return;
		try {
			await rollbackSystemPrompt(slug, entry.id);
			model.system_prompt = entry.prompt_text;
			promptHistory = await getSystemPromptHistory(slug);
			addToast('System prompt restored', 'success');
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to rollback', 'error');
		}
	}

	async function handleGenerateSampleQuestions() {
		if (!model) return;
		generatingSampleQuestions = true;
		try {
			model.sample_messages = await generateSampleMessages(slug);
			addToast('Sample questions generated', 'success');
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to generate questions', 'error');
		} finally {
			generatingSampleQuestions = false;
		}
	}

	function addSampleQuestion() {
		if (!model || !newSampleQuestion.trim()) return;
		model.sample_messages = [...model.sample_messages, newSampleQuestion.trim()];
		newSampleQuestion = '';
	}

	function removeSampleQuestion(index: number) {
		if (!model) return;
		model.sample_messages = model.sample_messages.filter((_, i) => i !== index);
	}

	async function handleSave() {
		if (!model) return;
		saving = true;
		try {
			const update: RagModelUpdate = {
				name: model.name,
				description: model.description,
				system_prompt: model.system_prompt,
				chunk_size: model.chunk_size,
				chunk_overlap: model.chunk_overlap,
				similarity_threshold: model.similarity_threshold,
				top_k: model.top_k,
				embedding_model: model.embedding_model,
				generation_model: model.generation_model,
				reranker_enabled: model.reranker_enabled,
				rerank_model: model.rerank_model,
				rerank_candidates: model.rerank_candidates,
				rerank_threshold: model.rerank_threshold,
				keyword_search_enabled: model.keyword_search_enabled,
				sample_messages: model.sample_messages,
				allowed_origins: model.allowed_origins,
				hosted_chat: model.hosted_chat,
				history_turns: model.history_turns,
				budget_limit: model.budget_limit,
				is_active: model.is_active
			};
			if (anthropicKeyInput.trim()) update.custom_anthropic_key = anthropicKeyInput.trim();
			if (voyageKeyInput.trim()) update.custom_voyage_key = voyageKeyInput.trim();
			model = await updateModel(slug, update);
			anthropicKeyInput = '';
			voyageKeyInput = '';
			addToast('Saved successfully', 'success');
			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 1500);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to save', 'error');
		} finally {
			saving = false;
		}
	}

	function isValidUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch {
			return false;
		}
	}

	async function handleAddSource() {
		addingSource = true;
		try {
			// Raw text → synchronous PUT /sources/{identifier}. POST /sources is URL-only.
			if (sourceType === 'text') {
				const identifier = sourceIdentifier.trim() || 'manual-text';
				const res = await upsertSource(slug, identifier, {
					content: sourceText,
					content_type: 'text'
				});
				addToast(res.message || 'Source added', 'success');

				// Optimistic row for instant feedback; the poll below replaces it with
				// the server row (including the real id needed for chunks/delete).
				if (!sources.find((s) => s.source_identifier === res.source_identifier)) {
					sources = [
						...sources,
						{
							id: 0,
							source_identifier: res.source_identifier,
							source_url: '',
							content_type: 'text',
							status: res.status,
							chunk_count: res.chunk_count,
							embedding_cost: res.embedding_cost,
							ingested_at: new Date().toISOString(),
							updated_at: new Date().toISOString()
						}
					];
				}

				sourceText = '';
				sourceIdentifier = '';
				startSourcePolling();
				return;
			}

			// URL source(s) → async POST /sources
			const invalid = parsedUrls.filter((u) => !isValidUrl(u));
			if (invalid.length > 0) {
				addToast(
					`Invalid URL${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}. Only http/https URLs are allowed.`,
					'error'
				);
				return;
			}
			const req: CreateSourceRequest = {};
			if (parsedUrls.length === 1) {
				req.url = parsedUrls[0];
				req.source_identifier = parsedUrls[0];
			} else {
				req.urls = parsedUrls;
			}
			const res = await createSource(slug, req);
			addToast(res.message || `${parsedUrls.length} source(s) added — processing...`, 'success');

			for (const url of parsedUrls) {
				if (!sources.find((s) => s.source_identifier === url)) {
					sources = [
						...sources,
						{
							id: 0,
							source_identifier: url,
							source_url: '',
							content_type: '',
							status: res.status || 'processing',
							chunk_count: 0,
							embedding_cost: 0,
							ingested_at: new Date().toISOString(),
							updated_at: new Date().toISOString()
						}
					];
				}
			}

			sourceUrlText = '';
			startSourcePolling();
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to add source', 'error');
		} finally {
			addingSource = false;
		}
	}

	async function toggleChunks(sourceId: number) {
		if (chunksSourceId === sourceId) {
			chunksSourceId = null;
			chunksData = null;
			return;
		}
		chunksSourceId = sourceId;
		chunksData = null;
		loadingChunks = true;
		try {
			chunksData = await getSourceChunks(slug, sourceId);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to load chunks', 'error');
			chunksSourceId = null;
		} finally {
			loadingChunks = false;
		}
	}

	async function handleCrawl() {
		if (parsedUrls.length === 0) return;
		if (!isValidUrl(parsedUrls[0])) {
			addToast('Invalid URL. Only http/https URLs are allowed.', 'error');
			return;
		}
		crawling = true;
		try {
			const res = await crawlSite(slug, parsedUrls[0], crawlMaxPages, crawlMaxDepth);
			addToast(res.message, 'success');
			sourceUrlText = '';
			startSourcePolling(true);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Crawl failed', 'error');
		} finally {
			crawling = false;
		}
	}

	async function handleUpload() {
		if (!fileInput?.files?.length) return;
		addingSource = true;
		try {
			const results = await uploadSources(slug, fileInput.files);
			addToast(`Uploaded ${results.length} file(s) — processing...`, 'success');
			fileInput.value = '';
			// Add placeholder sources immediately so user sees them as "processing"
			for (const r of results) {
				if (!sources.find((s) => s.source_identifier === r.source_identifier)) {
					sources = [
						...sources,
						{
							id: 0,
							source_identifier: r.source_identifier,
							source_url: '',
							content_type: '',
							status: r.status || 'processing',
							chunk_count: r.chunks_created ?? 0,
							embedding_cost: 0,
							ingested_at: new Date().toISOString(),
							updated_at: new Date().toISOString()
						}
					];
				}
			}
			startSourcePolling();
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Upload failed', 'error');
		} finally {
			addingSource = false;
		}
	}

	async function loadSourcesPage(offset: number, search?: string) {
		try {
			const q = search ?? sourcesSearch;
			const res = await getSources(slug, SOURCES_PER_PAGE, offset, q);
			sources = res.sources;
			sourcesTotal = res.total;
			sourcesOffset = offset;
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to load sources', 'error');
		}
	}

	function handleSourcesSearch(value: string) {
		sourcesSearch = value;
		clearTimeout(sourcesSearchTimer);
		sourcesSearchTimer = setTimeout(() => loadSourcesPage(0), 250);
	}

	async function handleDeleteSource(identifier: string) {
		if (!confirm('Delete this source and all its chunks?')) return;
		try {
			await deleteSource(slug, identifier);
			await loadTab('sources');
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to delete source', 'error');
		}
	}

	let reingestingSource = $state<string | null>(null);
	let reingestingAll = $state(false);

	async function handleReingestSource(identifier: string) {
		reingestingSource = identifier;
		try {
			const res = await reingestSource(slug, identifier);
			const item = res.sources[0];
			if (item?.mode === 'skipped') {
				addToast(item.reason ?? 'Nothing to rebuild for this source', 'error');
				return;
			}
			addToast(
				item?.mode === 'refetch'
					? 'Re-fetching and rebuilding source'
					: 'Rebuilding source from stored content',
				'success'
			);
			await loadSourcesPage(sourcesOffset);
			startSourcePolling();
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to rebuild source', 'error');
		} finally {
			reingestingSource = null;
		}
	}

	async function handleReingestAll() {
		if (
			!confirm(
				'Rebuild every source through the current extraction and chunking?\n\n' +
					'Sources with a URL are re-fetched; the rest are rebuilt from stored content. ' +
					'Every chunk is re-embedded, so this costs money and takes a while on large models.'
			)
		)
			return;
		reingestingAll = true;
		try {
			const res = await reingestAllSources(slug);
			const skipped = res.skipped ? `, ${res.skipped} skipped` : '';
			addToast(`Queued ${res.queued} source${res.queued === 1 ? '' : 's'}${skipped}`, 'success');
			await loadSourcesPage(sourcesOffset);
			startSourcePolling();
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to rebuild sources', 'error');
		} finally {
			reingestingAll = false;
		}
	}

	async function handlePurge() {
		if (!confirm('Delete ALL sources and chunks? This cannot be undone.')) return;
		try {
			await deleteAllSources(slug);
			await loadTab('sources');
			addToast('All sources purged', 'success');
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to purge', 'error');
		}
	}

	let newOrigin = $state('');

	function addOrigin() {
		const val = newOrigin.trim();
		if (!val || !model) return;
		if (!model.allowed_origins.includes(val)) {
			model.allowed_origins = [...model.allowed_origins, val];
		}
		newOrigin = '';
	}

	function removeOrigin(origin: string) {
		if (!model) return;
		model.allowed_origins = model.allowed_origins.filter((o) => o !== origin);
	}
	const tabs: { key: Tab; label: string }[] = [
		{ key: 'settings', label: 'Settings' },
		{ key: 'widget', label: 'Widget' },
		{ key: 'sources', label: 'Sources' },
		{ key: 'conversations', label: 'Conversations' },
		{ key: 'api-keys', label: 'RAGr API Keys' },
		{ key: 'stats', label: 'Stats' }
	];
</script>

<svelte:head>
	<title>{model?.name ?? 'Model'} - Admin</title>
</svelte:head>

{#if loading}
	<div class="text-text-muted">Loading...</div>
{:else if !model}
	<div class="text-text-muted">Model not found.</div>
{:else}
	<div class="mb-3">
		<a href="/admin" class="text-sm text-text-muted hover:text-accent">&larr; All Models</a>
		<div class="mt-1 flex flex-wrap items-center gap-3">
			<h1 class="text-2xl font-semibold">{model.name}</h1>
			<span class="font-mono text-sm text-text-muted">/{model.slug}</span>
			<a
				href="/chat/{model.slug}"
				target="_blank"
				rel="noopener"
				title="Open chat in a new tab"
				class="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-alt px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-accent hover:text-text"
			>
				<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
					<path
						d="M3 4h7v2H5v6h6V8h2v5a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm6-2h5v5h-2V4.4l-5.3 5.3-1.4-1.4L10.6 3H9V2z"
						fill="currentColor"
					/>
				</svg>
				Chat with this bot
			</a>
		</div>
	</div>

	<!-- Tabs -->
	<div
		class="mb-4 flex gap-1 overflow-x-auto border-b border-border"
		style="-ms-overflow-style:none;scrollbar-width:none;"
	>
		{#each tabs as tab}
			<button
				onclick={() => loadTab(tab.key)}
				class="shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:px-4 {activeTab ===
				tab.key
					? 'border-accent text-accent'
					: 'border-transparent text-text-muted hover:text-text'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if loadError}
		<div class="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
			{loadError}
		</div>
	{/if}

	<!-- Settings Tab -->
	{#if activeTab === 'settings'}
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSave();
			}}
			class="max-w-2xl space-y-6"
		>
			<!-- Behavior -->
			<section class="space-y-4 rounded-xl border border-border bg-surface-alt/30 p-5">
				<h3 class="text-sm font-semibold tracking-wider text-text uppercase">Behavior</h3>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label class="block">
						<span class="text-sm text-text-muted">Name</span>
						<input
							bind:value={model.name}
							class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-text focus:border-accent focus:outline-none"
						/>
					</label>
					<label class="block">
						<span class="text-sm text-text-muted">Description</span>
						<input
							bind:value={model.description}
							class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-text focus:border-accent focus:outline-none"
						/>
					</label>
				</div>
				<div class="block">
					<div class="flex items-center justify-between">
						<span class="text-sm text-text-muted">System Prompt</span>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={handleLoadPromptHistory}
								class="text-xs text-text-muted hover:text-accent"
							>
								{showPromptHistory ? 'Hide History' : 'History'}
							</button>
							<button
								type="button"
								onclick={handleGeneratePrompt}
								disabled={generatingPrompt}
								class="rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-400 hover:bg-purple-500/30 disabled:opacity-40"
							>
								{generatingPrompt ? 'Generating...' : '✨ Magic'}
							</button>
						</div>
					</div>
					<textarea
						bind:value={model.system_prompt}
						rows="4"
						class="mt-1 w-full resize-y rounded-lg border border-border bg-surface-alt px-3 py-2 font-mono text-sm text-text focus:border-accent focus:outline-none"
					></textarea>

					{#if showGeneratedPreview}
						<div class="mt-2 space-y-3 rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium text-purple-400">Generated Prompt</span>
								<button
									type="button"
									onclick={() => {
										showGeneratedPreview = false;
										generatedPrompt = '';
									}}
									class="text-xs text-text-muted hover:text-text">&times;</button
								>
							</div>
							<pre
								class="max-h-64 overflow-y-auto rounded-lg bg-surface p-3 font-mono text-sm whitespace-pre-wrap text-text">{generatedPrompt}{#if generatingPrompt}<span
										class="animate-pulse">|</span
									>{/if}</pre>
							{#if !generatingPrompt && generatedPrompt}
								<div class="flex gap-2">
									<button
										type="button"
										onclick={handleAcceptGenerated}
										class="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90"
									>
										Accept
									</button>
									<button
										type="button"
										onclick={() => {
											if (model) model.system_prompt = generatedPrompt;
											showGeneratedPreview = false;
											generatedPrompt = '';
										}}
										class="rounded-lg border border-border bg-surface-alt px-4 py-2 text-sm text-text-muted hover:text-text"
									>
										Copy to Editor
									</button>
									<button
										type="button"
										onclick={() => {
											showGeneratedPreview = false;
											generatedPrompt = '';
										}}
										class="px-2 text-sm text-text-muted hover:text-text"
									>
										Discard
									</button>
								</div>
							{/if}
						</div>
					{/if}

					{#if showPromptHistory}
						<div class="mt-2 space-y-2">
							{#if promptHistory.length === 0}
								<div class="text-sm text-text-muted">No history yet.</div>
							{:else}
								{#each promptHistory as entry}
									<div class="rounded-lg border border-border bg-surface-alt p-3">
										<div class="mb-1 flex items-center justify-between">
											<div class="flex items-center gap-2">
												<span
													class="rounded px-1.5 py-0.5 text-[10px] {entry.source === 'generated'
														? 'bg-purple-500/20 text-purple-400'
														: 'border border-border bg-surface text-text-muted'}"
													>{entry.source}</span
												>
												<span class="text-xs text-text-muted"
													>{new Date(entry.created_at).toLocaleString()}</span
												>
											</div>
											<button
												type="button"
												onclick={() => handleRollbackPrompt(entry)}
												class="text-xs text-accent hover:underline"
											>
												Restore
											</button>
										</div>
										{#if entry.input_text}
											<div class="mb-1 text-[10px] text-text-muted">
												Input: {entry.input_text.slice(0, 100)}{entry.input_text.length > 100
													? '...'
													: ''}
											</div>
										{/if}
										<pre
											class="max-h-24 overflow-y-auto font-mono text-xs whitespace-pre-wrap text-text">{entry.prompt_text}</pre>
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>

				<!-- Sample Questions -->
				<div class="block">
					<div class="flex items-center justify-between">
						<span class="text-sm text-text-muted">Sample Questions</span>
						<button
							type="button"
							onclick={handleGenerateSampleQuestions}
							disabled={generatingSampleQuestions}
							class="rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-400 hover:bg-purple-500/30 disabled:opacity-40"
						>
							{generatingSampleQuestions ? 'Generating...' : '✨ Magic'}
						</button>
					</div>
					<p class="mt-1 text-xs text-text-muted">
						Shown on off-topic responses. Toggle "Show in greeting" in the Widget tab.
					</p>
					{#if model.sample_messages.length > 0}
						<div class="mt-2 flex flex-wrap gap-2">
							{#each model.sample_messages as sample, i}
								<span
									class="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-sm"
								>
									{sample}
									<button
										type="button"
										onclick={() => removeSampleQuestion(i)}
										class="ml-1 text-text-muted hover:text-error">&times;</button
									>
								</span>
							{/each}
						</div>
					{/if}
					<div class="mt-2 flex gap-2">
						<input
							bind:value={newSampleQuestion}
							placeholder="Add a sample question..."
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addSampleQuestion();
								}
							}}
							class="flex-1 rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
						/>
						<button
							type="button"
							onclick={addSampleQuestion}
							class="rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-muted hover:border-accent hover:text-text"
							>+</button
						>
					</div>
				</div>
			</section>

			<!-- Retrieval & Generation -->
			<section class="space-y-5 rounded-xl border border-border bg-surface-alt/30 p-5">
				<h3 class="text-sm font-semibold tracking-wider text-text uppercase">
					Retrieval & Generation
				</h3>

				{#if hasContent}
					<div class="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted">
						Chunk size, chunk overlap, and embedding model are locked because this model already has
						ingested content. Changing them would invalidate stored chunks and break references in
						past chats. To re-chunk, delete all sources first.
					</div>
				{/if}

				<!-- Chunking -->
				<div class="space-y-3">
					<h4 class="text-xs font-medium tracking-wide text-text-muted uppercase">Chunking</h4>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<label class="block">
							<span class="inline-flex items-center gap-1">
								<span class="text-sm text-text-muted">Chunk Size</span>
								<span
									class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-text-muted"
									title="Number of characters per text chunk when ingesting sources">?</span
								>
							</span>
							<input
								type="number"
								disabled={hasContent}
								bind:value={model.chunk_size}
								class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-text focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							/>
						</label>
						<label class="block">
							<span class="inline-flex items-center gap-1">
								<span class="text-sm text-text-muted">Chunk Overlap</span>
								<span
									class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-text-muted"
									title="Character overlap between adjacent chunks. Higher values improve context continuity but increase storage"
									>?</span
								>
							</span>
							<input
								type="number"
								disabled={hasContent}
								bind:value={model.chunk_overlap}
								class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-text focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							/>
						</label>
					</div>
				</div>

				<!-- Search -->
				<div class="space-y-3">
					<h4 class="text-xs font-medium tracking-wide text-text-muted uppercase">Search</h4>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<label class="block">
							<span class="inline-flex items-center gap-1">
								<span class="text-sm text-text-muted">Similarity Threshold</span>
								<span
									class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-text-muted"
									title="Minimum cosine similarity (0-1) for a chunk to be considered relevant. Lower values return more results"
									>?</span
								>
							</span>
							<input
								type="number"
								step="0.01"
								bind:value={model.similarity_threshold}
								class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-text focus:border-accent focus:outline-none"
							/>
						</label>
						<label class="block">
							<span class="inline-flex items-center gap-1">
								<span class="text-sm text-text-muted">Top K</span>
								<span
									class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-text-muted"
									title="Maximum number of chunks retrieved per query">?</span
								>
							</span>
							<input
								type="number"
								bind:value={model.top_k}
								class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-text focus:border-accent focus:outline-none"
							/>
						</label>
						<label class="block">
							<span class="text-sm text-text-muted">Embedding Model</span>
							<select
								disabled={hasContent}
								bind:value={model.embedding_model}
								class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 font-mono text-sm text-text focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							>
								<option value="voyage-4-lite">voyage-4-lite</option>
								<option value="voyage-4">voyage-4</option>
								<option value="voyage-3">voyage-3</option>
								<option value="voyage-3-large">voyage-3-large</option>
								<option value="voyage-code-3">voyage-code-3</option>
							</select>
						</label>
					</div>
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							bind:checked={model.keyword_search_enabled}
							class="accent-accent"
						/>
						<span class="text-sm text-text-muted">Keyword Search</span>
						<span
							class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-text-muted"
							title="Enables PostgreSQL full-text search alongside vector similarity. Improves recall for exact-match queries"
							>?</span
						>
					</label>
				</div>

				<!-- Reranking -->
				<div class="space-y-3">
					<h4 class="text-xs font-medium tracking-wide text-text-muted uppercase">Reranking</h4>
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={model.reranker_enabled} class="accent-accent" />
						<span class="text-sm text-text-muted">Enable Reranker</span>
					</label>
					{#if model.reranker_enabled}
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<label class="block">
								<span class="text-sm text-text-muted">Rerank Model</span>
								<input
									bind:value={model.rerank_model}
									class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 font-mono text-sm text-text focus:border-accent focus:outline-none"
								/>
							</label>
							<label class="block">
								<span class="inline-flex items-center gap-1">
									<span class="text-sm text-text-muted">Candidates</span>
									<span
										class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-text-muted"
										title="Number of chunks passed to the reranker before filtering down to Top K"
										>?</span
									>
								</span>
								<input
									type="number"
									bind:value={model.rerank_candidates}
									min="1"
									class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 font-mono text-sm text-text focus:border-accent focus:outline-none"
								/>
							</label>
							<label class="block">
								<span class="inline-flex items-center gap-1">
									<span class="text-sm text-text-muted">Min Score</span>
									<span
										class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-text-muted"
										title="Minimum rerank score (0-1) to keep a chunk. Chunks scoring below this are dropped before reaching the LLM. Set to 0 to disable."
										>?</span
									>
								</span>
								<input
									type="number"
									step="0.01"
									min="0"
									max="1"
									bind:value={model.rerank_threshold}
									class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 font-mono text-sm text-text focus:border-accent focus:outline-none"
								/>
							</label>
						</div>
					{/if}
				</div>

				<!-- Generation -->
				<div class="space-y-3">
					<h4 class="text-xs font-medium tracking-wide text-text-muted uppercase">Generation</h4>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<label class="block">
							<span class="text-sm text-text-muted">Generation Model</span>
							<select
								bind:value={model.generation_model}
								class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 font-mono text-sm text-text focus:border-accent focus:outline-none"
							>
								<option value="claude-haiku-4-5">claude-haiku-4-5</option>
								<option value="claude-sonnet-4-5">claude-sonnet-4-5</option>
								<option value="claude-opus-4">claude-opus-4</option>
							</select>
						</label>
						<div>
							<div class="flex items-center gap-2">
								<span class="text-sm text-text-muted">History Turns</span>
								<span
									class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-text-muted"
									title="Number of previous conversation turns sent to the generator. Increases conversational quality but results in higher generation costs."
									>?</span
								>
							</div>
							<input
								type="number"
								min="0"
								bind:value={model.history_turns}
								class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-text focus:border-accent focus:outline-none"
							/>
						</div>
					</div>
				</div>
			</section>

			<!-- Access & Billing -->
			<section class="space-y-5 rounded-xl border border-border bg-surface-alt/30 p-5">
				<h3 class="text-sm font-semibold tracking-wider text-text uppercase">Access & Billing</h3>

				{#if currentUser.requiresByok && (!model.has_custom_anthropic_key || !model.has_custom_voyage_key)}
					<div class="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
						<div class="font-medium">Chat is blocked for this model.</div>
						<div class="mt-1 text-error/80">
							This model is missing
							{!model.has_custom_anthropic_key && !model.has_custom_voyage_key
								? 'both an Anthropic and a Voyage key'
								: !model.has_custom_anthropic_key
									? 'an Anthropic key'
									: 'a Voyage key'}. Add the missing key{!model.has_custom_anthropic_key &&
							!model.has_custom_voyage_key
								? 's'
								: ''} below to unblock chat.
						</div>
					</div>
				{/if}

				<!-- API Keys -->
				<div class="space-y-3">
					<h4 class="text-xs font-medium tracking-wide text-text-muted uppercase">Provider Keys</h4>
					<p class="text-xs text-text-muted">
						RAGr uses your Anthropic key for chat completions and your Voyage key for embedding
						sources.
						{#if currentUser.allowGlobalKeys}
							Without these, this model falls back to RAGr's global keys.
						{:else}
							Without these, chat is disabled.
						{/if}
					</p>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<label class="block">
							<span class="flex items-center gap-2">
								<span class="text-sm text-text-muted">Anthropic API Key</span>
								{#if model.has_custom_anthropic_key}
									<span class="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] text-green-400"
										>configured</span
									>
								{:else if currentUser.allowGlobalKeys}
									<span class="rounded bg-text-muted/10 px-1.5 py-0.5 text-[10px] text-text-muted"
										>using global</span
									>
								{:else}
									<span class="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-400"
										>not set</span
									>
								{/if}
							</span>
							<input
								type="password"
								bind:value={anthropicKeyInput}
								placeholder={model.has_custom_anthropic_key
									? 'Enter new key to replace'
									: 'sk-ant-...'}
								autocomplete="off"
								class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
							/>
						</label>
						<label class="block">
							<span class="flex items-center gap-2">
								<span class="text-sm text-text-muted">Voyage API Key</span>
								{#if model.has_custom_voyage_key}
									<span class="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] text-green-400"
										>configured</span
									>
								{:else if currentUser.allowGlobalKeys}
									<span class="rounded bg-text-muted/10 px-1.5 py-0.5 text-[10px] text-text-muted"
										>using global</span
									>
								{:else}
									<span class="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-400"
										>not set</span
									>
								{/if}
							</span>
							<input
								type="password"
								bind:value={voyageKeyInput}
								placeholder={model.has_custom_voyage_key ? 'Enter new key to replace' : 'pa-...'}
								autocomplete="off"
								class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
							/>
						</label>
					</div>
					<div class="flex items-center gap-4 text-xs text-text-muted">
						<span>Encrypted at rest. Leave blank to keep current key.</span>
						<a
							href="https://console.anthropic.com/settings/keys"
							target="_blank"
							rel="noopener noreferrer"
							class="whitespace-nowrap text-accent hover:underline">Anthropic &nearr;</a
						>
						<a
							href="https://dash.voyageai.com/api-keys"
							target="_blank"
							rel="noopener noreferrer"
							class="whitespace-nowrap text-accent hover:underline">Voyage &nearr;</a
						>
					</div>
				</div>

				<!-- Budget -->
				<div class="space-y-3">
					<h4 class="text-xs font-medium tracking-wide text-text-muted uppercase">Budget</h4>
					<label class="block max-w-xs">
						<span class="text-sm text-text-muted">Budget Limit ($)</span>
						<input
							type="number"
							step="0.01"
							bind:value={model.budget_limit}
							class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-text focus:border-accent focus:outline-none"
						/>
					</label>
				</div>

				<!-- Access -->
				<div class="space-y-3">
					<h4
						class="inline-flex items-center gap-1 text-xs font-medium tracking-wide text-text-muted uppercase"
					>
						Origins & Access
						<span
							class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] tracking-normal text-text-muted normal-case"
							title="Domains allowed to embed or call this model's chat widget (CORS)">?</span
						>
					</h4>
					<div>
						<div class="flex flex-wrap gap-2">
							{#each model.allowed_origins as origin}
								<span
									class="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-alt px-3 py-1 font-mono text-sm"
								>
									{origin}
									<button
										type="button"
										onclick={() => removeOrigin(origin)}
										class="ml-1 text-text-muted hover:text-error">&times;</button
									>
								</span>
							{/each}
						</div>
						<div class="mt-2 flex gap-2">
							<input
								bind:value={newOrigin}
								placeholder="https://example.com"
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										addOrigin();
									}
								}}
								class="flex-1 rounded-lg border border-border bg-surface-alt px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
							/>
							<button
								type="button"
								onclick={addOrigin}
								class="rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-muted hover:border-accent hover:text-text"
								>+</button
							>
						</div>
					</div>
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={model.hosted_chat} class="accent-accent" />
						<span class="text-sm text-text-muted"
							>Hosted Chat (expose at <a
								href="/chat/{model.slug}"
								target="_blank"
								class="text-accent hover:underline">/chat/{model.slug}</a
							>)</span
						>
					</label>
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={model.is_active} class="accent-accent" />
						<span class="text-sm text-text-muted">Active</span>
						<span
							class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-text-muted"
							title="When disabled, the chat widget and API return unavailable">?</span
						>
					</label>
				</div>
			</section>

			<button
				type="submit"
				disabled={saving}
				class="rounded-lg px-6 py-2 font-medium text-white transition-colors duration-200 disabled:opacity-40 {saveSuccess
					? 'bg-green-600'
					: 'bg-accent hover:bg-accent/90'}"
			>
				{saving ? 'Saving...' : saveSuccess ? '\u2713 Saved' : 'Save Changes'}
			</button>
		</form>

		<!-- Widget Tab -->
	{:else if activeTab === 'widget'}
		<WidgetTab {model} />
	{:else if activeTab === 'sources'}
		<div class="space-y-6">
			<!-- Add source -->
			<div class="space-y-3 rounded-lg border border-border bg-surface-alt p-4">
				<h3 class="text-sm font-medium">Add Source</h3>
				<div class="flex gap-2">
					{#each [['url', 'URL'], ['text', 'Text'], ['upload', 'Upload']] as [key, label]}
						<button
							onclick={() => setSourceType(key)}
							class="rounded-lg px-3 py-1 text-sm {sourceType === key
								? 'bg-accent text-white'
								: 'border border-border bg-surface text-text-muted hover:text-text'}"
						>
							{label}
						</button>
					{/each}
				</div>

				{#if sourceType === 'url'}
					<form
						onsubmit={(e) => {
							e.preventDefault();
							crawlEnabled ? handleCrawl() : handleAddSource();
						}}
						class="space-y-2"
					>
						{#if crawlEnabled}
							<input
								bind:value={sourceUrlText}
								placeholder="https://example.com"
								class="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
							/>
						{:else}
							<textarea
								bind:value={sourceUrlText}
								rows="3"
								placeholder="https://example.com/page-1"
								class="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
							></textarea>
						{/if}
						<label
							class="flex items-center gap-2"
							title={parsedUrls.length > 1 ? 'Crawl works with a single root URL' : ''}
						>
							<input
								type="checkbox"
								bind:checked={crawlEnabled}
								disabled={parsedUrls.length > 1}
								class="accent-accent"
							/>
							<span
								class="text-sm {parsedUrls.length > 1 ? 'text-text-muted/50' : 'text-text-muted'}"
								>Crawl site — follow links and ingest all pages</span
							>
							{#if parsedUrls.length > 1}
								<span class="text-[10px] text-text-muted/50">single URL only</span>
							{/if}
						</label>
						{#if crawlEnabled}
							<div class="grid grid-cols-2 gap-2">
								<label class="block">
									<span class="text-xs text-text-muted">Max pages</span>
									<input
										type="number"
										bind:value={crawlMaxPages}
										min="1"
										max="200"
										class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
									/>
								</label>
								<label class="block">
									<span class="text-xs text-text-muted">Max depth</span>
									<input
										type="number"
										bind:value={crawlMaxDepth}
										min="1"
										max="5"
										class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
									/>
								</label>
							</div>
						{/if}
						<div class="flex items-center justify-between">
							<span class="text-xs text-text-muted">
								{#if crawlEnabled}
									Crawl from a single root URL
								{:else if parsedUrls.length > 0}
									{parsedUrls.length} URL{parsedUrls.length !== 1 ? 's' : ''} ready
								{:else}
									One URL per line
								{/if}
							</span>
							<button
								type="submit"
								disabled={(crawlEnabled ? crawling : addingSource) || parsedUrls.length === 0}
								class="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-40"
							>
								{#if crawlEnabled}
									{crawling ? 'Starting crawl...' : 'Crawl'}
								{:else}
									{addingSource
										? 'Adding...'
										: parsedUrls.length > 1
											? `Add ${parsedUrls.length} URLs`
											: 'Add'}
								{/if}
							</button>
						</div>
					</form>
				{:else if sourceType === 'text'}
					<form
						onsubmit={(e) => {
							e.preventDefault();
							handleAddSource();
						}}
						class="space-y-2"
					>
						<input
							bind:value={sourceIdentifier}
							placeholder="Source name (optional)"
							class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
						/>
						<textarea
							bind:value={sourceText}
							rows="4"
							placeholder="Paste content here..."
							class="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
						></textarea>
						<button
							type="submit"
							disabled={addingSource || !sourceText.trim()}
							class="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-40"
						>
							{addingSource ? 'Adding...' : 'Add'}
						</button>
					</form>
				{:else}
					<div class="flex items-center gap-2">
						<input
							bind:this={fileInput}
							type="file"
							multiple
							accept=".txt,.md,.html,.htm,.pdf"
							class="hidden"
							onchange={handleUpload}
						/>
						<button
							type="button"
							onclick={() => fileInput?.click()}
							disabled={addingSource}
							class="cursor-pointer rounded-lg border border-dashed border-border bg-surface px-6 py-3 text-sm text-text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-40"
						>
							{addingSource ? 'Uploading...' : 'Choose files to upload...'}
						</button>
					</div>
				{/if}
			</div>

			<!-- Source list -->
			<div class="flex items-center gap-3">
				<input
					type="text"
					value={sourcesSearch}
					oninput={(e) => handleSourcesSearch(e.currentTarget.value)}
					placeholder="Search sources..."
					class="flex-1 rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
				/>
				{#if sourcesSearch}
					<button
						onclick={() => handleSourcesSearch('')}
						class="text-xs text-text-muted hover:text-text">&times; Clear</button
					>
				{/if}
			</div>
			{#if sources.length > 0}
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-medium text-text-muted">
						{sourcesTotal} source{sourcesTotal !== 1 ? 's' : ''}{sourcesSearch
							? ` matching "${sourcesSearch}"`
							: ''}
						{#if sourcesTotal > SOURCES_PER_PAGE}
							<span class="text-text-muted/60"
								>&middot; page {Math.floor(sourcesOffset / SOURCES_PER_PAGE) + 1} of {Math.ceil(
									sourcesTotal / SOURCES_PER_PAGE
								)}</span
							>
						{/if}
					</h3>
					<div class="flex items-center gap-3">
						<button
							onclick={handleReingestAll}
							disabled={reingestingAll}
							title="Rebuild every source through the current extraction and chunking"
							class="text-xs text-accent hover:underline disabled:opacity-50"
							>{reingestingAll ? 'Queueing...' : 'Rebuild All'}</button
						>
						<button onclick={handlePurge} class="text-xs text-error hover:underline"
							>Purge All</button
						>
					</div>
				</div>
				<div class="space-y-2">
					{#each sources as source (source.source_identifier)}
						<div
							transition:slide={{ duration: 300 }}
							class="flex items-center justify-between rounded-lg border border-border bg-surface-alt px-4 py-3"
						>
							<div class="min-w-0 flex-1">
								<div class="truncate text-sm font-medium">{source.source_identifier}</div>
								<div class="mt-1 text-xs text-text-muted">
									{source.content_type} &middot;
									{#if source.chunk_count > 0}
										<button
											onclick={() => toggleChunks(source.id)}
											class="cursor-pointer text-accent hover:underline"
											>{source.chunk_count} chunks</button
										>
									{:else}
										{source.chunk_count} chunks
									{/if}
									&middot;
									<span
										class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium {source.status ===
										'complete'
											? 'bg-emerald-500/15 text-emerald-400'
											: source.status === 'error' || source.status === 'failed'
												? 'bg-rose-500/15 text-rose-300'
												: source.status === 'crawling' || source.status === 'processing'
													? 'bg-indigo-500/15 text-indigo-400'
													: 'bg-slate-500/15 text-slate-400'}">{source.status}</span
									>
									{#if source.source_url && /^https?:\/\//i.test(source.source_url)}
										&middot; <a
											href={source.source_url}
											target="_blank"
											class="break-all text-accent hover:underline">{source.source_url}</a
										>
									{/if}
								</div>
								{#if source.status_detail}
									<div class="mt-1.5 text-xs text-rose-300">{source.status_detail}</div>
								{/if}
							</div>
							<div class="ml-4 flex shrink-0 items-center gap-3">
								<button
									onclick={() => handleReingestSource(source.source_identifier)}
									disabled={reingestingSource === source.source_identifier}
									title="Re-run this source through the current extraction and chunking"
									class="text-sm text-text-muted hover:text-accent disabled:opacity-50"
									>{reingestingSource === source.source_identifier
										? 'Rebuilding...'
										: 'Rebuild'}</button
								>
								<button
									onclick={() => handleDeleteSource(source.source_identifier)}
									class="text-sm text-text-muted hover:text-error">Delete</button
								>
							</div>
						</div>
						{#if chunksSourceId === source.id}
							<div class="ml-4 space-y-2 rounded-lg border border-border bg-surface p-4">
								{#if loadingChunks}
									<div class="text-sm text-text-muted">Loading chunks...</div>
								{:else if chunksData}
									<div class="mb-2 flex items-center justify-between">
										<span class="text-xs text-text-muted">{chunksData.total} chunk(s)</span>
										<button
											onclick={() => {
												chunksSourceId = null;
												chunksData = null;
											}}
											class="text-xs text-text-muted hover:text-text">&times; Close</button
										>
									</div>
									<p class="mb-3 text-xs text-text-muted">
										Chunks are stored as raw text fragments. The chat model handles cleanup,
										formatting, and context when answering — messiness here is expected and doesn't
										affect answer quality.
									</p>
									{#each chunksData.chunks as chunk, i}
										<div class="rounded-lg border border-border bg-surface-alt p-3">
											<div class="mb-1 flex items-center justify-between">
												<span class="font-mono text-[10px] text-text-muted">Chunk {i + 1}</span>
												<span class="text-[10px] text-text-muted">{chunk.content_type}</span>
											</div>
											<pre
												class="max-h-48 overflow-y-auto text-xs wrap-break-word whitespace-pre-wrap text-text">{chunk.content}</pre>
										</div>
									{/each}
								{/if}
							</div>
						{/if}
					{/each}
				</div>
				{#if sourcesTotal > SOURCES_PER_PAGE}
					<div class="flex items-center justify-between pt-2">
						<button
							onclick={() => loadSourcesPage(sourcesOffset - SOURCES_PER_PAGE)}
							disabled={sourcesOffset === 0}
							class="text-sm text-accent hover:underline disabled:cursor-not-allowed disabled:text-text-muted disabled:no-underline"
						>
							&larr; Previous
						</button>
						<span class="text-xs text-text-muted">
							{sourcesOffset + 1}–{Math.min(sourcesOffset + SOURCES_PER_PAGE, sourcesTotal)} of {sourcesTotal}
						</span>
						<button
							onclick={() => loadSourcesPage(sourcesOffset + SOURCES_PER_PAGE)}
							disabled={sourcesOffset + SOURCES_PER_PAGE >= sourcesTotal}
							class="text-sm text-accent hover:underline disabled:cursor-not-allowed disabled:text-text-muted disabled:no-underline"
						>
							Next &rarr;
						</button>
					</div>
				{/if}
			{:else}
				<div class="rounded-lg border border-dashed border-border p-8 text-center">
					<p class="text-sm text-text-muted">No sources yet</p>
					<p class="mt-1 text-xs text-text-muted">
						Add URLs, paste text, or upload files above to give your model knowledge.
					</p>
				</div>
			{/if}
		</div>

		<!-- Conversations Tab -->
	{:else if activeTab === 'conversations'}
		<ConversationsTab />
	{:else if activeTab === 'api-keys'}
		<ApiKeysTab {model} />
	{:else if activeTab === 'stats'}
		<StatsTab />
	{/if}
{/if}
