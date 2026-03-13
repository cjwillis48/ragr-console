<script lang="ts">
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';
	import { getModel, updateModel, getTheme, updateTheme, getStats, getConversations, getSources, getSourceChunks, getChunksByIds, createSource, deleteSource, deleteAllSources, uploadSources, listApiKeys, createApiKey, revokeApiKey } from '$lib/admin-api';
	import type { RagModel, RagModelUpdate, WidgetTheme, StatsResponse, ConversationResponse, SourceResponse, CreateSourceRequest, ChunkListResponse, ChunkDetail, ApiKeyRead, ApiKeyCreateResponse } from '$lib/admin-types';
	import ChatPanel from '$lib/components/ChatPanel.svelte';

	type Tab = 'settings' | 'widget' | 'sources' | 'conversations' | 'api-keys' | 'stats';

	let model = $state<RagModel | null>(null);
	let stats = $state<StatsResponse | null>(null);
	let conversations = $state<ConversationResponse[]>([]);
	let conversationsTotal = $state(0);
	let sources = $state<SourceResponse[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
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

	// Source add form
	let sourceType = $state<'url' | 'text' | 'upload'>('url');
	let sourceUrl = $state('');
	let sourceText = $state('');
	let sourceIdentifier = $state('');
	let addingSource = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let sourcePollTimer: ReturnType<typeof setInterval> | null = null;

	// Widget theme
	let theme = $state<WidgetTheme>({});
	let savingTheme = $state(false);
	let embedCopiedInTab = $state(false);
	let fontDropdownOpen = $state(false);
	let fontFilterActive = $state(false);
	const fontFamilies = ['Inter', 'Roboto', 'Open Sans', 'Poppins', 'Montserrat', 'Merriweather', 'Playfair Display', 'Courier New', 'Georgia', 'Fira Code'];
	const systemFonts = ['Courier New', 'Georgia'];
	const googleFontUrl = 'https://fonts.googleapis.com/css2?family=' + fontFamilies.filter(f => !systemFonts.includes(f)).map(f => f.replace(/ /g, '+')).join('&family=') + '&display=swap';

	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (fontDropdownOpen && !target.closest('.font-dropdown-wrapper')) {
			fontDropdownOpen = false;
		}
	}
	let launcherHintText = $derived(theme.launcher_hint?.trim() || '');

	// Chunks viewer
	let chunksData = $state<ChunkListResponse | null>(null);
	let chunksSourceId = $state<number | null>(null);
	let loadingChunks = $state(false);

	// Conversation chunks
	let expandedConvId = $state<number | null>(null);
	let convChunks = $state<ChunkDetail[]>([]);
	let loadingConvChunks = $state(false);

	// API keys
	let apiKeys = $state<ApiKeyRead[]>([]);
	let newKeyLabel = $state('');
	let creatingKey = $state(false);
	let newlyCreatedKey = $state<ApiKeyCreateResponse | null>(null);
	let keyCopied = $state(false);

	onMount(() => {
		loadModel().then(() => {
			if (activeTab !== 'settings') loadTab(activeTab);
		});
		return () => stopSourcePolling();
	});

	function startSourcePolling() {
		stopSourcePolling();
		sourcePollTimer = setInterval(async () => {
			try {
				const res = await getSources(page.params.slug);
				sources = res.sources;
				if (sources.every((s) => s.status === 'complete' || s.status === 'error')) {
					stopSourcePolling();
				}
			} catch { /* ignore polling errors */ }
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
		error = null;
		try {
			model = await getModel(page.params.slug);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to load model';
		} finally {
			loading = false;
		}
	}

	async function loadTab(tab: Tab) {
		activeTab = tab;
		window.location.hash = tab;
		error = null;
		success = null;
		if (tab !== 'sources') stopSourcePolling();
		try {
			if (tab === 'widget') {
				theme = await getTheme(page.params.slug);
			} else if (tab === 'stats') {
				stats = await getStats(page.params.slug);
			} else if (tab === 'conversations') {
				const res = await getConversations(page.params.slug);
				conversations = res.conversations;
				conversationsTotal = res.total;
			} else if (tab === 'sources') {
				const res = await getSources(page.params.slug);
				sources = res.sources;
			} else if (tab === 'api-keys') {
				apiKeys = await listApiKeys(page.params.slug);
				newlyCreatedKey = null;
			}
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to load data';
		}
	}

	async function handleSave() {
		if (!model) return;
		saving = true;
		error = null;
		success = null;
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
				allowed_origins: model.allowed_origins,
				hosted_chat: model.hosted_chat,
				history_turns: model.history_turns,
				budget_limit: model.budget_limit,
				is_active: model.is_active
			};
			if (anthropicKeyInput.trim()) update.anthropic_api_key = anthropicKeyInput.trim();
			if (voyageKeyInput.trim()) update.voyage_api_key = voyageKeyInput.trim();
			model = await updateModel(page.params.slug, update);
			anthropicKeyInput = '';
			voyageKeyInput = '';
			success = 'Saved successfully';
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to save';
		} finally {
			saving = false;
		}
	}

	async function handleAddSource() {
		addingSource = true;
		error = null;
		success = null;
		try {
			const req: CreateSourceRequest = {};
			if (sourceType === 'url') {
				req.url = sourceUrl.trim();
				req.source_identifier = sourceUrl.trim();
			} else if (sourceType === 'text') {
				req.content = sourceText;
				req.source_identifier = sourceIdentifier.trim() || 'manual-text';
			}
			const res = await createSource(page.params.slug, req);
			success = res.message || 'Source added — processing...';
			const identifier = sourceUrl.trim() || sourceIdentifier.trim() || 'manual-text';
			sourceUrl = '';
			sourceText = '';
			sourceIdentifier = '';
			if (!sources.find(s => s.source_identifier === identifier)) {
				sources = [...sources, {
					id: 0,
					source_identifier: res.source_identifier || identifier,
					source_url: '',
					content_type: '',
					status: res.status || 'processing',
					chunk_count: res.chunks_created ?? 0,
					embedding_cost: 0,
					ingested_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				}];
			}
			startSourcePolling();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to add source';
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
			chunksData = await getSourceChunks(page.params.slug, sourceId);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to load chunks';
			chunksSourceId = null;
		} finally {
			loadingChunks = false;
		}
	}

	async function toggleConversation(conv: ConversationResponse) {
		if (expandedConvId === conv.id) {
			expandedConvId = null;
			convChunks = [];
			return;
		}
		expandedConvId = conv.id;
		convChunks = [];
		if (!conv.retrieved_chunks?.length) return;
		loadingConvChunks = true;
		try {
			const ids = conv.retrieved_chunks.map(c => c.chunk_id);
			convChunks = await getChunksByIds(page.params.slug, ids);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to load chunks';
			expandedConvId = null;
		} finally {
			loadingConvChunks = false;
		}
	}

	async function handleUpload() {
		if (!fileInput?.files?.length) return;
		addingSource = true;
		error = null;
		try {
			const results = await uploadSources(page.params.slug, fileInput.files);
			success = `Uploaded ${results.length} file(s) — processing...`;
			fileInput.value = '';
			// Add placeholder sources immediately so user sees them as "processing"
			for (const r of results) {
				if (!sources.find(s => s.source_identifier === r.source_identifier)) {
					sources = [...sources, {
						id: 0,
						source_identifier: r.source_identifier,
						source_url: '',
						content_type: '',
						status: r.status || 'processing',
						chunk_count: r.chunks_created ?? 0,
						embedding_cost: 0,
						ingested_at: new Date().toISOString(),
						updated_at: new Date().toISOString()
					}];
				}
			}
			startSourcePolling();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			addingSource = false;
		}
	}

	async function handleDeleteSource(id: number) {
		if (!confirm('Delete this source and all its chunks?')) return;
		try {
			await deleteSource(page.params.slug, id);
			await loadTab('sources');
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to delete source';
		}
	}

	async function handlePurge() {
		if (!confirm('Delete ALL sources and chunks? This cannot be undone.')) return;
		try {
			await deleteAllSources(page.params.slug);
			await loadTab('sources');
			success = 'All sources purged';
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to purge';
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

	function getEmbedSnippet(): string {
		const url = `${location.origin}/chat/${model?.slug}/embed`;
		return `<iframe\n  src="${url}"\n  sandbox="allow-scripts allow-same-origin allow-forms"\n  style="position:fixed;bottom:0;right:0;width:450px;height:650px;border:none;z-index:9999;"\n></iframe>`;
	}

	async function copyEmbedInTab() {
		await navigator.clipboard.writeText(getEmbedSnippet());
		embedCopiedInTab = true;
		setTimeout(() => (embedCopiedInTab = false), 2000);
	}

	async function handleSaveTheme() {
		savingTheme = true;
		error = null;
		success = null;
		try {
			theme = await updateTheme(page.params.slug, theme);
			success = 'Theme saved';
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to save theme';
		} finally {
			savingTheme = false;
		}
	}

	async function handleCreateKey() {
		if (!newKeyLabel.trim()) return;
		creatingKey = true;
		error = null;
		try {
			newlyCreatedKey = await createApiKey(page.params.slug, newKeyLabel.trim());
			newKeyLabel = '';
			apiKeys = await listApiKeys(page.params.slug);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to create key';
		} finally {
			creatingKey = false;
		}
	}

	async function handleRevokeKey(keyId: number) {
		if (!confirm('Revoke this API key? This cannot be undone.')) return;
		try {
			await revokeApiKey(page.params.slug, keyId);
			apiKeys = await listApiKeys(page.params.slug);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to revoke key';
		}
	}

	async function copyRawKey() {
		if (!newlyCreatedKey) return;
		await navigator.clipboard.writeText(newlyCreatedKey.raw_key);
		keyCopied = true;
		setTimeout(() => (keyCopied = false), 2000);
	}

	const tabs: { key: Tab; label: string }[] = [
		{ key: 'settings', label: 'Settings' },
		{ key: 'widget', label: 'Widget' },
		{ key: 'sources', label: 'Sources' },
		{ key: 'conversations', label: 'Conversations' },
		{ key: 'api-keys', label: 'API Keys' },
		{ key: 'stats', label: 'Stats' }
	];
</script>

<svelte:window onclick={handleWindowClick} />
<svelte:head>
	<title>{model?.name ?? 'Model'} - Admin</title>
	<link rel="stylesheet" href={googleFontUrl} />
</svelte:head>

{#if loading}
	<div class="text-text-muted">Loading...</div>
{:else if !model}
	<div class="text-text-muted">Model not found.</div>
{:else}
	<div class="mb-6">
		<a href="/admin" class="text-sm text-text-muted hover:text-accent">&larr; All Models</a>
		<div class="flex items-center gap-4 mt-2">
			<h1 class="text-2xl font-semibold">{model.name}</h1>
			<span class="text-sm text-text-muted font-mono">/{model.slug}</span>
		</div>
	</div>

	<!-- Tabs -->
	<div class="flex gap-1 border-b border-border mb-6">
		{#each tabs as tab}
			<button
				onclick={() => loadTab(tab.key)}
				class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === tab.key
					? 'border-accent text-accent'
					: 'border-transparent text-text-muted hover:text-text'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if error}
		<div class="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-sm text-error mb-4">{error}</div>
	{/if}
	{#if success}
		<div class="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400 mb-4">{success}</div>
	{/if}

	<!-- Settings Tab -->
	{#if activeTab === 'settings'}
		<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="space-y-4 max-w-2xl">
			<fieldset class="space-y-4">
				<legend class="text-sm font-medium text-text-muted mb-2">General</legend>
				<label class="block">
					<span class="text-sm text-text-muted">Name</span>
					<input bind:value={model.name} class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text focus:outline-none focus:border-accent" />
				</label>
				<label class="block">
					<span class="text-sm text-text-muted">Description</span>
					<textarea bind:value={model.description} rows="2" class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text focus:outline-none focus:border-accent resize-none"></textarea>
				</label>
				<label class="block">
					<span class="text-sm text-text-muted">System Prompt</span>
					<textarea bind:value={model.system_prompt} rows="4" class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text font-mono text-sm focus:outline-none focus:border-accent resize-y"></textarea>
				</label>
			</fieldset>

			<fieldset class="space-y-4">
				<legend class="text-sm font-medium text-text-muted mb-2">RAG Config</legend>
				<div class="grid grid-cols-2 gap-4">
					<label class="block">
						<span class="text-sm text-text-muted">Chunk Size</span>
						<input type="number" bind:value={model.chunk_size} class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text focus:outline-none focus:border-accent" />
					</label>
					<label class="block">
						<span class="text-sm text-text-muted">Chunk Overlap</span>
						<input type="number" bind:value={model.chunk_overlap} class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text focus:outline-none focus:border-accent" />
					</label>
					<label class="block">
						<span class="text-sm text-text-muted">Similarity Threshold</span>
						<input type="number" step="0.01" bind:value={model.similarity_threshold} class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text focus:outline-none focus:border-accent" />
					</label>
					<label class="block">
						<span class="text-sm text-text-muted">Top K</span>
						<input type="number" bind:value={model.top_k} class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text focus:outline-none focus:border-accent" />
					</label>
				</div>
			</fieldset>

			<fieldset class="space-y-4">
				<legend class="text-sm font-medium text-text-muted mb-2">Models</legend>
				<label class="block">
					<span class="text-sm text-text-muted">Embedding Model</span>
					<input bind:value={model.embedding_model} class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text font-mono text-sm focus:outline-none focus:border-accent" />
				</label>
				<label class="block">
					<span class="text-sm text-text-muted">Generation Model</span>
					<input bind:value={model.generation_model} class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text font-mono text-sm focus:outline-none focus:border-accent" />
				</label>
				<label class="flex items-center gap-2">
					<input type="checkbox" bind:checked={model.reranker_enabled} class="accent-accent" />
					<span class="text-sm text-text-muted">Reranker Enabled</span>
				</label>
				{#if model.reranker_enabled}
					<label class="block">
						<span class="text-sm text-text-muted">Rerank Model</span>
						<input bind:value={model.rerank_model} class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text font-mono text-sm focus:outline-none focus:border-accent" />
					</label>
				{/if}
			</fieldset>

			<fieldset class="space-y-4">
				<legend class="text-sm font-medium text-text-muted mb-2">API Keys</legend>
				<label class="block">
					<div class="flex items-center gap-2">
						<span class="text-sm text-text-muted">Anthropic API Key</span>
						{#if model.has_custom_anthropic_key}
							<span class="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">configured</span>
						{/if}
					</div>
					<input
						type="password"
						bind:value={anthropicKeyInput}
						placeholder={model.has_custom_anthropic_key ? 'Enter new key to replace' : 'sk-ant-...'}
						autocomplete="off"
						class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text font-mono text-sm placeholder:text-text-muted focus:outline-none focus:border-accent"
					/>
				</label>
				<label class="block">
					<div class="flex items-center gap-2">
						<span class="text-sm text-text-muted">Voyage API Key</span>
						{#if model.has_custom_voyage_key}
							<span class="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">configured</span>
						{/if}
					</div>
					<input
						type="password"
						bind:value={voyageKeyInput}
						placeholder={model.has_custom_voyage_key ? 'Enter new key to replace' : 'pa-...'}
						autocomplete="off"
						class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text font-mono text-sm placeholder:text-text-muted focus:outline-none focus:border-accent"
					/>
				</label>
				<div class="flex items-center gap-4 text-xs text-text-muted">
					<span>Keys are encrypted at rest. Leave blank to keep current key. Budget is hard capped at $10 unless custom keys are provided.</span>
					<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline whitespace-nowrap">Get Anthropic key &nearr;</a>
					<a href="https://dash.voyageai.com/api-keys" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline whitespace-nowrap">Get Voyage key &nearr;</a>
				</div>
			</fieldset>

			<fieldset class="space-y-4">
				<legend class="text-sm font-medium text-text-muted mb-2">Access</legend>
				<div>
					<span class="text-sm text-text-muted">Allowed Origins</span>
					<div class="mt-1 flex flex-wrap gap-2">
						{#each model.allowed_origins as origin}
							<span class="inline-flex items-center gap-1 bg-surface-alt border border-border rounded-lg px-3 py-1 text-sm font-mono">
								{origin}
								<button type="button" onclick={() => removeOrigin(origin)} class="text-text-muted hover:text-error ml-1">&times;</button>
							</span>
						{/each}
					</div>
					<div class="mt-2 flex gap-2">
						<input
							bind:value={newOrigin}
							placeholder="https://example.com"
							onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOrigin(); } }}
							class="flex-1 rounded-lg bg-surface-alt border border-border px-3 py-2 text-text font-mono text-sm placeholder:text-text-muted focus:outline-none focus:border-accent"
						/>
						<button type="button" onclick={addOrigin} class="rounded-lg bg-surface-alt border border-border px-3 py-2 text-sm text-text-muted hover:text-text hover:border-accent">+</button>
					</div>
				</div>
				<label class="flex items-center gap-2">
					<input type="checkbox" bind:checked={model.hosted_chat} class="accent-accent" />
					<span class="text-sm text-text-muted">Hosted Chat (expose at <a href="/chat/{model.slug}" target="_blank" class="text-accent hover:underline">/chat/{model.slug}</a>)</span>
				</label>
				<div>
					<div class="flex items-center gap-2">
						<span class="text-sm text-text-muted">History Turns</span>
						<span
							class="inline-flex items-center justify-center w-4 h-4 rounded-full border border-border text-[10px] text-text-muted cursor-help"
							title="Number of previous conversation turns sent to the generator. Increases conversational quality but results in higher generation costs."
						>?</span>
					</div>
					<input type="number" min="0" bind:value={model.history_turns} class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text focus:outline-none focus:border-accent" />
				</div>
				<label class="block">
					<span class="text-sm text-text-muted">Budget Limit ($)</span>
					<input type="number" step="0.01" bind:value={model.budget_limit} class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text focus:outline-none focus:border-accent" />
				</label>
				<label class="flex items-center gap-2">
					<input type="checkbox" bind:checked={model.is_active} class="accent-accent" />
					<span class="text-sm text-text-muted">Active</span>
				</label>
			</fieldset>

			<button
				type="submit"
				disabled={saving}
				class="rounded-lg bg-accent px-6 py-2 text-white font-medium hover:bg-accent/90 disabled:opacity-40"
			>
				{saving ? 'Saving...' : 'Save Changes'}
			</button>
		</form>

	<!-- Widget Tab -->
	{:else if activeTab === 'widget'}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
			<!-- Theme Form -->
			<form onsubmit={(e) => { e.preventDefault(); handleSaveTheme(); }} class="space-y-4">
				<fieldset class="space-y-4">
					<legend class="text-sm font-medium text-text-muted mb-2">Text</legend>
					<label class="block">
						<span class="text-sm text-text-muted">Label</span>
						<input bind:value={theme.label} placeholder="Your assistant tagline" class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text placeholder:text-text-muted focus:outline-none focus:border-accent" />
					</label>
					<label class="block">
						<span class="text-sm text-text-muted">Greeting</span>
						<textarea bind:value={theme.greeting} rows="2" placeholder="Hi! How can I help?" class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"></textarea>
					</label>
					<label class="block">
						<span class="text-sm text-text-muted">Placeholder</span>
						<input bind:value={theme.placeholder} placeholder="Ask a question..." class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text placeholder:text-text-muted focus:outline-none focus:border-accent" />
					</label>
					<label class="block">
						<span class="text-sm text-text-muted">Launcher Hint</span>
						<input bind:value={theme.launcher_hint} placeholder="Text shown above the chat button" class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text placeholder:text-text-muted focus:outline-none focus:border-accent" />
					</label>
				</fieldset>

				<fieldset class="space-y-4">
					<legend class="text-sm font-medium text-text-muted mb-2">Colors</legend>
					<div class="grid grid-cols-2 gap-4">
						{#each [
							['Primary', 'primary_color', '#6366f1'],
							['Background', 'bg_color', '#0f172a'],
							['Text', 'text_color', '#e2e8f0'],
							['User Bubble', 'user_bubble_color', '#4f46e5'],
							['Bot Bubble', 'bot_bubble_color', '#1e293b']
						] as [label, key, fallback]}
							<label class="block">
								<span class="text-sm text-text-muted">{label}</span>
								<div class="mt-1 flex items-center gap-2">
									<input
										type="color"
										value={theme[key as keyof WidgetTheme] as string ?? fallback}
										oninput={(e) => { theme = { ...theme, [key]: (e.target as HTMLInputElement).value }; }}
										class="h-9 w-9 rounded border border-border cursor-pointer"
									/>
									<input
										type="text"
										value={theme[key as keyof WidgetTheme] as string ?? ''}
										oninput={(e) => { theme = { ...theme, [key]: (e.target as HTMLInputElement).value }; }}
										placeholder={fallback}
										class="flex-1 rounded-lg bg-surface-alt border border-border px-3 py-2 text-text font-mono text-sm placeholder:text-text-muted focus:outline-none focus:border-accent"
									/>
								</div>
							</label>
						{/each}
					</div>
				</fieldset>

				<fieldset class="space-y-4">
					<legend class="text-sm font-medium text-text-muted mb-2">Style</legend>
					<div class="block">
						<span class="text-sm text-text-muted">Font Family</span>
						<div class="relative mt-1 font-dropdown-wrapper">
							<input
								bind:value={theme.font_family}
								placeholder="Inter"
								onfocus={() => { fontDropdownOpen = true; fontFilterActive = false; }}
								oninput={() => { fontDropdownOpen = true; fontFilterActive = true; }}
								class="w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text text-sm placeholder:text-text-muted focus:outline-none focus:border-accent"
								style="font-family: {theme.font_family || 'inherit'};"
							/>
							{#if fontDropdownOpen}
								<div class="absolute z-20 mt-1 w-full rounded-lg bg-surface-alt border border-border shadow-lg max-h-56 overflow-y-auto">
									{#each fontFamilies.filter(f => !fontFilterActive || !theme.font_family || f.toLowerCase().includes((theme.font_family ?? '').toLowerCase())) as font}
										<button
											type="button"
											class="w-full text-left px-3 py-2 text-sm text-text hover:bg-accent/20 transition-colors"
											style="font-family: '{font}', sans-serif;"
											onclick={() => { theme.font_family = font; fontDropdownOpen = false; fontFilterActive = false; }}
										>
											{font}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
					<label class="block">
						<span class="text-sm text-text-muted">Border Radius (px)</span>
						<input type="number" bind:value={theme.border_radius} placeholder="12" class="mt-1 w-full rounded-lg bg-surface-alt border border-border px-3 py-2 text-text focus:outline-none focus:border-accent" />
					</label>
				</fieldset>

				<button
					type="submit"
					disabled={savingTheme}
					class="rounded-lg bg-accent px-6 py-2 text-white font-medium hover:bg-accent/90 disabled:opacity-40"
				>
					{savingTheme ? 'Saving...' : 'Save Theme'}
				</button>
			</form>

			<!-- Embed Code + Preview -->
			<div class="space-y-4">
				<div>
					<div class="flex items-center justify-between mb-2">
						<span class="text-sm font-medium text-text-muted">Embed Code</span>
						<button
							onclick={copyEmbedInTab}
							class="text-xs text-accent hover:underline"
						>
							{embedCopiedInTab ? 'Copied!' : 'Copy'}
						</button>
					</div>
					<pre class="bg-surface-alt border border-border rounded-lg p-3 text-xs font-mono text-text overflow-x-auto whitespace-pre-wrap break-all">{getEmbedSnippet()}</pre>
				</div>

				<div>
					<span class="text-sm font-medium text-text-muted">Chat Panel Preview</span>
					<div class="mt-2 rounded-lg overflow-hidden" style="height: 500px;">
						<ChatPanel
							slug={model.slug}
							name={model.name}
							description={model.description}
							label={theme.label}
							greeting={theme.greeting ?? ''}
							placeholder={theme.placeholder ?? ''}
							launcherHint={theme.launcher_hint}
							acceptingRequests={model.is_active}
							inline={true}
							primaryColor={theme.primary_color}
							bgColor={theme.bg_color}
							textColor={theme.text_color}
							userBubbleColor={theme.user_bubble_color}
							botBubbleColor={theme.bot_bubble_color}
							fontFamily={theme.font_family}
							borderRadius={theme.border_radius}
						/>
					</div>
				</div>

				<!-- Launcher preview -->
				<div>
					<span class="text-sm font-medium text-text-muted">Launcher Preview</span>
					<div class="mt-2 flex flex-col items-end gap-2">
						{#if launcherHintText}
							<div
								class="rounded-xl px-3 py-2 text-xs shadow-md border"
								style="background: {theme.bg_color ?? '#0f172a'}; color: {theme.text_color ?? '#e2e8f0'}; border-color: color-mix(in srgb, {theme.text_color ?? '#e2e8f0'} 20%, transparent); font-family: {theme.font_family ?? 'inherit'};"
							>
								{launcherHintText}
							</div>
						{/if}
						<button
							class="inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
							style="background: {theme.primary_color ?? '#6366f1'};"
						>
							<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path
									d="M8 10h8M8 14h5M12 3C7.03 3 3 6.58 3 11c0 2.02.84 3.87 2.23 5.29L5 21l4.08-1.91c.92.25 1.9.38 2.92.38 4.97 0 9-3.58 9-8s-4.03-8.47-9-8.47z"
									stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>

	<!-- Sources Tab -->
	{:else if activeTab === 'sources'}
		<div class="space-y-6">
			<!-- Add source -->
			<div class="bg-surface-alt border border-border rounded-lg p-4 space-y-3">
				<h3 class="text-sm font-medium">Add Source</h3>
				<div class="flex gap-2">
					{#each [['url', 'URL'], ['text', 'Text'], ['upload', 'Upload']] as [key, label]}
						<button
							onclick={() => (sourceType = key as 'url' | 'text' | 'upload')}
							class="px-3 py-1 text-sm rounded-lg {sourceType === key
								? 'bg-accent text-white'
								: 'bg-surface border border-border text-text-muted hover:text-text'}"
						>
							{label}
						</button>
					{/each}
				</div>

				{#if sourceType === 'url'}
					<form onsubmit={(e) => { e.preventDefault(); handleAddSource(); }} class="flex gap-2">
						<input bind:value={sourceUrl} placeholder="https://example.com/page" class="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent" />
						<button type="submit" disabled={addingSource || !sourceUrl.trim()} class="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-40">
							{addingSource ? 'Adding...' : 'Add'}
						</button>
					</form>
				{:else if sourceType === 'text'}
					<form onsubmit={(e) => { e.preventDefault(); handleAddSource(); }} class="space-y-2">
						<input bind:value={sourceIdentifier} placeholder="Source name (optional)" class="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent" />
						<textarea bind:value={sourceText} rows="4" placeholder="Paste content here..." class="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent resize-y"></textarea>
						<button type="submit" disabled={addingSource || !sourceText.trim()} class="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-40">
							{addingSource ? 'Adding...' : 'Add'}
						</button>
					</form>
				{:else}
					<div class="flex gap-2 items-center">
						<input bind:this={fileInput} type="file" multiple class="hidden" onchange={handleUpload} />
						<button
							type="button"
							onclick={() => fileInput?.click()}
							disabled={addingSource}
							class="rounded-lg bg-surface border border-dashed border-border px-6 py-3 text-sm text-text-muted hover:text-text hover:border-accent transition-colors cursor-pointer disabled:opacity-40"
						>
							{addingSource ? 'Uploading...' : 'Choose files to upload...'}
						</button>
					</div>
				{/if}
			</div>

			<!-- Source list -->
			{#if sources.length > 0}
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-medium text-text-muted">{sources.length} source(s)</h3>
					<button onclick={handlePurge} class="text-xs text-error hover:underline">Purge All</button>
				</div>
				<div class="space-y-2">
					{#each sources as source}
						<div class="bg-surface-alt border border-border rounded-lg px-4 py-3 flex items-center justify-between">
							<div class="min-w-0 flex-1">
								<div class="text-sm font-medium truncate">{source.source_identifier}</div>
								<div class="text-xs text-text-muted mt-1">
									{source.content_type} &middot;
									{#if source.chunk_count > 0}
										<button
											onclick={() => toggleChunks(source.id)}
											class="text-accent hover:underline cursor-pointer"
										>{source.chunk_count} chunks</button>
									{:else}
										{source.chunk_count} chunks
									{/if}
									&middot; {source.status}
									{#if source.source_url}
										&middot; <a href={source.source_url} target="_blank" class="text-accent hover:underline">{source.source_url}</a>
									{/if}
								</div>
							</div>
							<button onclick={() => handleDeleteSource(source.id)} class="text-sm text-text-muted hover:text-error ml-4 shrink-0">Delete</button>
						</div>
						{#if chunksSourceId === source.id}
							<div class="bg-surface border border-border rounded-lg p-4 ml-4 space-y-2">
								{#if loadingChunks}
									<div class="text-text-muted text-sm">Loading chunks...</div>
								{:else if chunksData}
									<div class="flex items-center justify-between mb-2">
										<span class="text-xs text-text-muted">{chunksData.total} chunk(s)</span>
										<button onclick={() => { chunksSourceId = null; chunksData = null; }} class="text-xs text-text-muted hover:text-text">&times; Close</button>
									</div>
									{#each chunksData.chunks as chunk, i}
										<div class="bg-surface-alt border border-border rounded-lg p-3">
											<div class="flex items-center justify-between mb-1">
												<span class="text-[10px] font-mono text-text-muted">Chunk {i + 1}</span>
												<span class="text-[10px] text-text-muted">{chunk.content_type}</span>
											</div>
											<pre class="text-xs text-text whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{chunk.content}</pre>
										</div>
									{/each}
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			{:else}
				<div class="text-text-muted text-sm">No sources yet.</div>
			{/if}
		</div>

	<!-- Conversations Tab -->
	{:else if activeTab === 'conversations'}
		{#if conversations.length === 0}
			<div class="text-text-muted text-sm">No conversations yet.</div>
		{:else}
			<div class="text-sm text-text-muted mb-4">{conversationsTotal} total conversation(s)</div>
			<div class="space-y-3">
				{#each conversations as conv}
					<button
						type="button"
						class="w-full text-left bg-surface-alt border border-border rounded-lg p-4 space-y-2 hover:border-accent/50 transition-colors cursor-pointer"
						onclick={() => toggleConversation(conv)}
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="text-xs px-2 py-0.5 rounded {conv.status === 'answered'
									? 'bg-green-500/20 text-green-400'
									: conv.status === 'off_topic'
										? 'bg-yellow-500/20 text-yellow-400'
										: 'bg-red-500/20 text-red-400'}">{conv.status}</span>
								{#if conv.retrieved_chunks?.length}
									<span class="text-[10px] text-text-muted">{conv.retrieved_chunks.length} chunks</span>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<span class="text-xs text-text-muted">{new Date(conv.created_at).toLocaleString()}</span>
								<span class="text-xs text-text-muted">{expandedConvId === conv.id ? '▲' : '▼'}</span>
							</div>
						</div>
						<div>
							<div class="text-sm font-medium">Q: {conv.question}</div>
							<div class="text-sm text-text-muted mt-1">A: {conv.answer}</div>
						</div>
						<div class="text-xs text-text-muted">
							Tokens: {conv.tokens_in} in / {conv.tokens_out} out
						</div>
					</button>
					{#if expandedConvId === conv.id}
						<div class="ml-4 space-y-2">
							{#if loadingConvChunks}
								<div class="text-text-muted text-sm">Loading chunks...</div>
							{:else if !conv.retrieved_chunks?.length}
								<div class="text-text-muted text-sm">No chunks were retrieved for this conversation.</div>
							{:else if convChunks.length === 0}
								<div class="text-text-muted text-sm">Chunk content unavailable.</div>
							{:else}
								<div class="flex items-center justify-between mb-1">
									<span class="text-xs text-text-muted">{convChunks.length} retrieved chunk(s)</span>
								</div>
								{#each convChunks as chunk, i}
									{@const ref = conv.retrieved_chunks.find(r => r.chunk_id === chunk.id)}
									<div class="bg-surface border border-border rounded-lg p-3">
										<div class="flex items-center justify-between mb-1">
											<span class="text-[10px] font-mono text-text-muted">
												{chunk.source_identifier} &middot; {chunk.content_type}
											</span>
											<span class="text-[10px] text-text-muted">
												{#if ref}
													dist: {ref.distance.toFixed(3)}{ref.rerank_score != null ? ` · rerank: ${ref.rerank_score.toFixed(3)}` : ''}
												{/if}
											</span>
										</div>
										<pre class="text-xs text-text whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{chunk.content}</pre>
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{/if}

	<!-- API Keys Tab -->
	{:else if activeTab === 'api-keys'}
		<div class="space-y-6 max-w-2xl">
			<div class="flex items-center gap-3">
				<h3 class="text-sm font-medium text-text-muted">API Keys</h3>
				<a
					href="{env.PUBLIC_RAGR_API_URL}/docs"
					target="_blank"
					rel="noopener noreferrer"
					class="text-xs text-accent hover:underline"
				>
					API Docs &nearr;
				</a>
			</div>

			<!-- Scope info -->
			<div class="bg-surface-alt border border-border rounded-lg p-4 text-xs text-text-muted space-y-2">
				<p class="font-medium text-text">Per-model keys are scoped to <span class="font-mono text-accent">/{model.slug}</span> only.</p>
				<div class="grid grid-cols-2 gap-x-6 gap-y-1">
					<span>Chat, Sources, Conversations</span><span class="text-green-400">Allowed</span>
					<span>Stats, Theme, Config</span><span class="text-green-400">Allowed</span>
					<span>API Key management</span><span class="text-green-400">Allowed</span>
					<span>Create/list/delete models</span><span class="text-red-400">Admin only</span>
				</div>
				<p>A key for this model cannot access other models. Using it on a different slug returns <span class="font-mono">401</span>.</p>
			</div>

			<!-- Create key -->
			<form onsubmit={(e) => { e.preventDefault(); handleCreateKey(); }} class="bg-surface-alt border border-border rounded-lg p-4 space-y-3">
				<h3 class="text-sm font-medium">Generate New Key</h3>
				<div class="flex gap-2">
					<input
						bind:value={newKeyLabel}
						placeholder="Key label (e.g. 'production', 'staging')"
						class="flex-1 rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
					/>
					<button
						type="submit"
						disabled={creatingKey || !newKeyLabel.trim()}
						class="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-40"
					>
						{creatingKey ? 'Creating...' : 'Generate'}
					</button>
				</div>
			</form>

			<!-- Newly created key banner -->
			{#if newlyCreatedKey}
				<div class="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-green-400">Key created: {newlyCreatedKey.label}</span>
						<button onclick={() => (newlyCreatedKey = null)} class="text-xs text-text-muted hover:text-text">&times;</button>
					</div>
					<div class="flex items-center gap-2">
						<code class="flex-1 bg-surface rounded-lg px-3 py-2 text-sm font-mono text-text break-all select-all">{newlyCreatedKey.raw_key}</code>
						<button
							onclick={copyRawKey}
							class="rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-muted hover:text-text hover:border-accent shrink-0"
						>
							{keyCopied ? 'Copied!' : 'Copy'}
						</button>
					</div>
					<p class="text-xs text-yellow-400">This key will only be shown once. Save it now.</p>
				</div>
			{/if}

			<!-- Key list -->
			{#if apiKeys.length > 0}
				<div class="space-y-2">
					{#each apiKeys as key}
						<div class="bg-surface-alt border border-border rounded-lg px-4 py-3 flex items-center justify-between">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium">{key.label}</span>
									{#if !key.is_active}
										<span class="text-xs bg-error/20 text-error px-2 py-0.5 rounded">revoked</span>
									{/if}
								</div>
								<div class="text-xs text-text-muted mt-1 font-mono">
									{key.key_prefix}...
									<span class="font-sans ml-2">
										Created {new Date(key.created_at).toLocaleDateString()}
										{#if key.last_used_at}
											&middot; Last used {new Date(key.last_used_at).toLocaleDateString()}
										{:else}
											&middot; Never used
										{/if}
									</span>
								</div>
							</div>
							{#if key.is_active}
								<button onclick={() => handleRevokeKey(key.id)} class="text-sm text-text-muted hover:text-error ml-4 shrink-0">Revoke</button>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-text-muted text-sm">No API keys yet.</div>
			{/if}
		</div>

	<!-- Stats Tab -->
	{:else if activeTab === 'stats'}
		{#if stats}
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
				{#each [
					['Sources', stats.total_sources],
					['Chunks', stats.total_chunks],
					['Conversations', stats.total_conversations],
					['Unanswered', stats.unanswered_questions],
					['Month Cost', `$${stats.current_month_cost.toFixed(2)}`],
					['Budget Limit', `$${stats.budget_limit.toFixed(2)}`],
					['Remaining', `$${stats.budget_remaining.toFixed(2)}`]
				] as [label, value]}
					<div class="bg-surface-alt border border-border rounded-lg p-4">
						<div class="text-sm text-text-muted">{label}</div>
						<div class="text-xl font-semibold mt-1">{value}</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-text-muted text-sm">Loading stats...</div>
		{/if}
	{/if}

{/if}
