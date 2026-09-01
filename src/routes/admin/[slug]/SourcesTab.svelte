<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import {
		deleteAllSources,
		deleteSource,
		getSourceChunks,
		getSources,
		reingestAllSources,
		reingestSource
	} from '$lib/admin-api';
	import type { ChunkListResponse, SourceResponse } from '$lib/admin-types';
	import { addToast } from '$lib/toast.svelte';
	import AddSourceForm, { type QueuedSources } from './AddSourceForm.svelte';

	let { sourcesTotal = $bindable(0) }: { sourcesTotal?: number } = $props();

	const slug = $derived(page.params.slug!);

	let sources = $state<SourceResponse[]>([]);
	let sourcesOffset = $state(0);
	let sourcesSearch = $state('');
	let sourcesSearchTimer: ReturnType<typeof setTimeout> | undefined;
	const SOURCES_PER_PAGE = 50;

	let sourcePollTimer: ReturnType<typeof setInterval> | null = null;
	// Statuses the backend never moves off on its own — anything else means
	// work is still in flight and the poll must keep going.
	const TERMINAL_SOURCE_STATUSES = new Set(['complete', 'error', 'failed']);

	// Chunks viewer
	let chunksData = $state<ChunkListResponse | null>(null);
	let chunksSourceId = $state<number | null>(null);
	let loadingChunks = $state(false);

	let reingestingSource = $state<string | null>(null);
	let reingestingAll = $state(false);

	onMount(() => {
		loadSourcesPage(0);
		return () => stopSourcePolling();
	});

	// A submit queued work: show the new rows right away, then poll until the
	// backend reports them done.
	function handleQueued({ placeholders, keepAlive = false }: QueuedSources) {
		for (const p of placeholders) {
			if (!sources.find((s) => s.source_identifier === p.source_identifier)) {
				sources = [...sources, p];
			}
		}
		startSourcePolling(keepAlive);
	}

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
			await loadSourcesPage(sourcesOffset);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to delete source', 'error');
		}
	}

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
			sourcesSearch = '';
			await loadSourcesPage(0, '');
			addToast('All sources purged', 'success');
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to purge', 'error');
		}
	}
</script>

<div class="space-y-6">
	<AddSourceForm onQueued={handleQueued} />

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
				<button onclick={handlePurge} class="text-xs text-error hover:underline">Purge All</button>
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
								Chunks are stored as raw text fragments. The chat model handles cleanup, formatting,
								and context when answering — messiness here is expected and doesn't affect answer
								quality.
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
