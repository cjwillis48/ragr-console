<script lang="ts">
	import { isNonAnswered, getStatusLabel, getStatusDescription, getStatusContainerClass, getStatusBadgeClass, getStatusDescriptionClass, renderMarkdown } from '$lib/chat-utils';

	let {
		role,
		content,
		status,
		isStreaming = false,
		modelName,
		suggestions = [],
		onsuggestion
	}: {
		role: 'user' | 'assistant';
		content: string;
		status?: string;
		isStreaming?: boolean;
		modelName?: string;
		suggestions?: string[];
		onsuggestion?: (text: string) => void;
	} = $props();


</script>

<div class="flex {role === 'user' ? 'justify-end' : 'justify-start'} mb-3">
	{#if role === 'user'}
		<p class="max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap bg-indigo-600 text-white">
			{content}
		</p>
	{:else}
		<div class="max-w-[85%]">
			<div class="rounded-2xl px-3 py-2 text-sm {isNonAnswered(status) ? getStatusContainerClass(status) : getStatusContainerClass(undefined)}">
				{#if isNonAnswered(status)}
					<div class="mb-2 flex items-start gap-2">
						<span
							class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide {getStatusBadgeClass(status)}"
							title={getStatusDescription(status)}
						>
							<svg viewBox="0 0 16 16" class="h-3 w-3" fill="none" aria-hidden="true">
								<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" />
								<path d="M8 7.1v3.3M8 5.2h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
							</svg>
							{getStatusLabel(status)}
						</span>
					</div>
					<p class="mb-2 text-[11px] leading-snug {getStatusDescriptionClass(status)}">
						{getStatusDescription(status)}
					</p>
				{/if}
				{#if content}
					<div class="chat-markdown wrap-break-word [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:underline [&_a]:break-all [&_code]:text-[0.95em] [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5">
						{@html renderMarkdown(content)}
					</div>
				{:else if isStreaming}
					<span class="text-slate-500 dark:text-slate-400">Thinking...</span>
				{/if}
			</div>
			{#if suggestions.length > 0 && onsuggestion}
				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each suggestions as suggestion}
						<button
							type="button"
							class="rounded-full border border-slate-300/80 bg-white/80 px-2.5 py-1 text-[11px] leading-tight text-slate-700 hover:bg-white dark:border-slate-500/60 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
							onclick={() => onsuggestion?.(suggestion)}
						>
							{suggestion}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
