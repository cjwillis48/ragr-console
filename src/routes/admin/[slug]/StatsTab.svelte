<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getDailyStats, getStats, getTopSources } from '$lib/admin-api';
	import type { DailyStatsEntry, StatsResponse, TopSourceEntry } from '$lib/admin-types';
	import { addToast } from '$lib/toast.svelte';

	const slug = $derived(page.params.slug!);

	let stats = $state<StatsResponse | null>(null);
	let dailyStats = $state<DailyStatsEntry[]>([]);
	let topSources = $state<TopSourceEntry[]>([]);

	async function load() {
		try {
			[stats, dailyStats, topSources] = await Promise.all([
				getStats(slug),
				getDailyStats(slug),
				getTopSources(slug)
			]);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to load stats', 'error');
		}
	}

	onMount(() => {
		load();
	});
</script>

{#if stats}
	<!-- Summary cards -->
	<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
		{#each [['Sources', stats.total_sources, ''], ['Chunks', stats.total_chunks, ''], ['Conversations', stats.total_conversations, ''], ['Messages', stats.total_messages, ''], ['Unanswered', stats.unanswered_messages, stats.unanswered_messages > 0 ? 'text-yellow-400' : ''], ['Month Cost', `$${stats.current_month_cost.toFixed(2)}`, ''], ['Budget Limit', `$${stats.budget_limit.toFixed(2)}`, ''], ['Remaining', `$${stats.budget_remaining.toFixed(2)}`, stats.budget_remaining < stats.budget_limit * 0.2 ? 'text-red-400' : '']] as [label, value, highlight]}
			<div class="rounded-lg border border-border bg-surface-alt p-4">
				<div class="text-sm text-text-muted">{label}</div>
				<div class="mt-1 text-xl font-semibold {highlight}">{value}</div>
			</div>
		{/each}
	</div>

	<!-- Daily message volume chart -->
	{#if dailyStats.length > 0}
		{@const maxMessages = Math.max(
			...dailyStats.map((d) => d.answered + d.unanswered + d.off_topic),
			1
		)}
		<div class="mb-8 rounded-lg border border-border bg-surface-alt p-5">
			<h3 class="mb-4 text-sm font-medium">Message Volume (30 days)</h3>
			<div class="flex h-40 items-end gap-0.75">
				{#each dailyStats as day}
					{@const total = day.answered + day.unanswered + day.off_topic}
					{@const pct = (total / maxMessages) * 100}
					{@const answeredPct = total > 0 ? (day.answered / total) * pct : 0}
					{@const unansweredPct = total > 0 ? (day.unanswered / total) * pct : 0}
					{@const offTopicPct = total > 0 ? (day.off_topic / total) * pct : 0}
					<div class="group relative flex h-full flex-1 flex-col justify-end">
						{#if total > 0}
							<div class="flex flex-col justify-end" style="height: {pct}%;">
								{#if offTopicPct > 0}
									<div
										class="min-h-0.5 rounded-t-sm bg-yellow-500"
										style="height: {(offTopicPct / pct) * 100}%;"
									></div>
								{/if}
								{#if unansweredPct > 0}
									<div
										class="min-h-0.5 bg-red-400 {offTopicPct === 0 ? 'rounded-t-sm' : ''}"
										style="height: {(unansweredPct / pct) * 100}%;"
									></div>
								{/if}
								{#if answeredPct > 0}
									<div
										class="min-h-0.5 bg-green-500 {unansweredPct === 0 && offTopicPct === 0
											? 'rounded-t-sm'
											: ''}"
										style="height: {(answeredPct / pct) * 100}%;"
									></div>
								{/if}
							</div>
						{:else}
							<div class="rounded-t-sm bg-border/30" style="height: 2px;"></div>
						{/if}
						<div
							class="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs whitespace-nowrap shadow-lg group-hover:block"
						>
							<div class="mb-1 font-medium">
								{new Date(day.date).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric'
								})}
							</div>
							<div class="text-green-400">{day.answered} answered</div>
							{#if day.unanswered > 0}<div class="text-red-400">
									{day.unanswered} unanswered
								</div>{/if}
							{#if day.off_topic > 0}<div class="text-yellow-400">
									{day.off_topic} off-topic
								</div>{/if}
							<div class="mt-1 text-text-muted">
								{(day.tokens_in + day.tokens_out).toLocaleString()} tokens
							</div>
						</div>
					</div>
				{/each}
			</div>
			<div class="mt-2 flex justify-between text-[10px] text-text-muted">
				<span
					>{dailyStats.length > 0
						? new Date(dailyStats[0].date).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							})
						: ''}</span
				>
				<span
					>{dailyStats.length > 0
						? new Date(dailyStats[dailyStats.length - 1].date).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							})
						: ''}</span
				>
			</div>
			<div class="mt-3 flex gap-4 text-xs text-text-muted">
				<span class="flex items-center gap-1.5"
					><span class="inline-block h-2.5 w-2.5 rounded-sm bg-green-500"></span> Answered</span
				>
				<span class="flex items-center gap-1.5"
					><span class="inline-block h-2.5 w-2.5 rounded-sm bg-red-400"></span> Unanswered</span
				>
				<span class="flex items-center gap-1.5"
					><span class="inline-block h-2.5 w-2.5 rounded-sm bg-yellow-500"></span> Off-topic</span
				>
			</div>
		</div>

		<!-- Daily token usage chart -->
		{@const maxTokens = Math.max(...dailyStats.map((d) => d.tokens_in + d.tokens_out), 1)}
		<div class="mb-8 rounded-lg border border-border bg-surface-alt p-5">
			<h3 class="mb-4 text-sm font-medium">Token Usage (30 days)</h3>
			<div class="flex h-28 items-end gap-0.75">
				{#each dailyStats as day}
					{@const totalTokens = day.tokens_in + day.tokens_out}
					{@const pct = (totalTokens / maxTokens) * 100}
					{@const inPct = totalTokens > 0 ? (day.tokens_in / totalTokens) * pct : 0}
					{@const outPct = totalTokens > 0 ? (day.tokens_out / totalTokens) * pct : 0}
					<div class="group relative flex h-full flex-1 flex-col justify-end">
						{#if totalTokens > 0}
							<div class="flex flex-col justify-end" style="height: {pct}%;">
								<div
									class="min-h-0.5 rounded-t-sm bg-sky-400"
									style="height: {(inPct / pct) * 100}%;"
								></div>
								<div
									class="min-h-0.5 bg-indigo-500"
									style="height: {(outPct / pct) * 100}%;"
								></div>
							</div>
						{:else}
							<div class="rounded-t-sm bg-border/30" style="height: 2px;"></div>
						{/if}
						<div
							class="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs whitespace-nowrap shadow-lg group-hover:block"
						>
							<div class="font-medium">
								{new Date(day.date).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric'
								})}
							</div>
							<div class="text-sky-400">{day.tokens_in.toLocaleString()} in</div>
							<div class="text-indigo-400">{day.tokens_out.toLocaleString()} out</div>
						</div>
					</div>
				{/each}
			</div>
			<div class="mt-2 flex justify-between text-[10px] text-text-muted">
				<span
					>{dailyStats.length > 0
						? new Date(dailyStats[0].date).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							})
						: ''}</span
				>
				<span
					>{dailyStats.length > 0
						? new Date(dailyStats[dailyStats.length - 1].date).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							})
						: ''}</span
				>
			</div>
			<div class="mt-3 flex gap-4 text-xs text-text-muted">
				<span class="flex items-center gap-1.5"
					><span class="inline-block h-2.5 w-2.5 rounded-sm bg-sky-400"></span> Input</span
				>
				<span class="flex items-center gap-1.5"
					><span class="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500"></span> Output</span
				>
			</div>
		</div>
	{:else}
		<div class="mb-8 rounded-lg border border-dashed border-border p-8 text-center">
			<p class="text-sm text-text-muted">No activity data yet</p>
			<p class="mt-1 text-xs text-text-muted">
				Charts will appear once your model starts receiving messages.
			</p>
		</div>
	{/if}

	<!-- Top sources -->
	{#if topSources.length > 0}
		{@const maxRetrievals = topSources[0].retrieval_count}
		<div class="rounded-lg border border-border bg-surface-alt p-5">
			<h3 class="mb-4 text-sm font-medium">Top Sources by Retrieval</h3>
			<div class="space-y-2">
				{#each topSources as source}
					<div class="flex items-center gap-3">
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm">{source.source_identifier}</div>
							<div class="mt-1 h-2 overflow-hidden rounded-full bg-surface">
								<div
									class="h-full rounded-full bg-accent"
									style="width: {(source.retrieval_count / maxRetrievals) * 100}%;"
								></div>
							</div>
						</div>
						<div class="shrink-0 text-right">
							<div class="text-sm font-medium">{source.retrieval_count}</div>
							<div class="text-[10px] text-text-muted">{source.chunk_count} chunks</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{:else}
	<div class="text-sm text-text-muted">Loading stats...</div>
{/if}
