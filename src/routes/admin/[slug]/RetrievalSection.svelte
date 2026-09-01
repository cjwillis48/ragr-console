<script lang="ts">
	import type { RagModel } from '$lib/admin-types';

	let { model, hasContent }: { model: RagModel; hasContent: boolean } = $props();
</script>

<section class="space-y-5 rounded-xl border border-border bg-surface-alt/30 p-5">
	<h3 class="text-sm font-semibold tracking-wider text-text uppercase">Retrieval & Generation</h3>

	{#if hasContent}
		<div class="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted">
			Chunk size, chunk overlap, and embedding model are locked because this model already has
			ingested content. Changing them would invalidate stored chunks and break references in past
			chats. To re-chunk, delete all sources first.
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
			<input type="checkbox" bind:checked={model.keyword_search_enabled} class="accent-accent" />
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
							title="Number of chunks passed to the reranker before filtering down to Top K">?</span
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
