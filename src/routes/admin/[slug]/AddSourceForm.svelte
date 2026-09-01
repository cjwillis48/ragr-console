<script module lang="ts">
	import type { SourceResponse } from '$lib/admin-types';

	/** Rows queued by a submit, handed to the parent so it can show them
	 *  optimistically and start polling. Crawl queues nothing up front, so it
	 *  sends an empty list with keepAlive set. */
	export type QueuedSources = { placeholders: SourceResponse[]; keepAlive?: boolean };
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { crawlSite, createSource, uploadSources, upsertSource } from '$lib/admin-api';
	import type { CreateSourceRequest } from '$lib/admin-types';
	import { addToast } from '$lib/toast.svelte';

	let { onQueued }: { onQueued: (q: QueuedSources) => void } = $props();

	const slug = $derived(page.params.slug!);

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

	function setSourceType(key: string) {
		sourceType = key as typeof sourceType;
	}

	function isValidUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch {
			return false;
		}
	}

	// Optimistic row for instant feedback; the parent's poll replaces it with the
	// server row (including the real id needed for chunks/delete).
	function placeholder(
		identifier: string,
		status: string,
		extra: Partial<SourceResponse> = {}
	): SourceResponse {
		const now = new Date().toISOString();
		return {
			id: 0,
			source_identifier: identifier,
			source_url: '',
			content_type: '',
			status,
			chunk_count: 0,
			embedding_cost: 0,
			ingested_at: now,
			updated_at: now,
			...extra
		};
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
				sourceText = '';
				sourceIdentifier = '';
				onQueued({
					placeholders: [
						placeholder(res.source_identifier, res.status, {
							content_type: 'text',
							chunk_count: res.chunk_count,
							embedding_cost: res.embedding_cost
						})
					]
				});
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
			const queued = parsedUrls.map((url) => placeholder(url, res.status || 'processing'));
			sourceUrlText = '';
			onQueued({ placeholders: queued });
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to add source', 'error');
		} finally {
			addingSource = false;
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
			// Pages arrive over time, so the poll has to outlive the first all-done tick.
			onQueued({ placeholders: [], keepAlive: true });
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
			onQueued({
				placeholders: results.map((r) =>
					placeholder(r.source_identifier, r.status || 'processing', {
						chunk_count: r.chunks_created ?? 0
					})
				)
			});
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Upload failed', 'error');
		} finally {
			addingSource = false;
		}
	}
</script>

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
				<span class="text-sm {parsedUrls.length > 1 ? 'text-text-muted/50' : 'text-text-muted'}"
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
