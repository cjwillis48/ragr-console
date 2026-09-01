<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		acceptGeneratedPrompt,
		generateSampleMessages,
		getModel,
		getSystemPromptHistory,
		rollbackSystemPrompt,
		streamGenerateSystemPrompt,
		updateModel
	} from '$lib/admin-api';
	import type { RagModel, RagModelUpdate, SystemPromptHistoryEntry } from '$lib/admin-types';
	import { addToast } from '$lib/toast.svelte';
	import { currentUser } from '$lib/current-user.svelte';
	import ApiKeysTab from './ApiKeysTab.svelte';
	import ConversationsTab from './ConversationsTab.svelte';
	import SourcesTab from './SourcesTab.svelte';
	import StatsTab from './StatsTab.svelte';
	import WidgetTab from './WidgetTab.svelte';

	const slug = $derived(page.params.slug!);

	type Tab = 'settings' | 'widget' | 'sources' | 'conversations' | 'api-keys' | 'stats';

	let model = $state<RagModel | null>(null);
	let sourcesTotal = $state(0);

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

	onMount(() => {
		loadModel();
	});

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

	// Each tab component fetches its own data when it mounts, so switching tabs
	// is just a render — no loader to coordinate here.
	function selectTab(tab: Tab) {
		activeTab = tab;
		window.location.hash = tab;
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
				onclick={() => selectTab(tab.key)}
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
		<SourcesTab bind:sourcesTotal />
	{:else if activeTab === 'conversations'}
		<ConversationsTab />
	{:else if activeTab === 'api-keys'}
		<ApiKeysTab {model} />
	{:else if activeTab === 'stats'}
		<StatsTab />
	{/if}
{/if}
