<script lang="ts">
	import DOMPurify from 'isomorphic-dompurify';
	import { marked } from 'marked';

	let {
		role,
		content,
		status,
		isStreaming = false,
		modelName,
		onsuggestion
	}: {
		role: 'user' | 'assistant';
		content: string;
		status?: string;
		isStreaming?: boolean;
		modelName?: string;
		onsuggestion?: (text: string) => void;
	} = $props();

	function renderMarkdown(text: string): string {
		const html = marked.parse(text, { gfm: true, breaks: true });
		return DOMPurify.sanitize(typeof html === 'string' ? html : '');
	}

	function isNonAnswered(s: string | undefined): boolean {
		return typeof s === 'string' && s !== 'answered';
	}

	function getStatusLabel(s: string | undefined): string {
		if (s === 'off_topic') return 'Off-topic';
		if (s === 'unanswered') return 'Unanswered';
		if (s === 'error') return 'Error';
		return s?.replace(/_/g, ' ') ?? 'Status';
	}

	function getStatusDescription(s: string | undefined): string {
		if (s === 'off_topic') return "This question may be outside this assistant's knowledge.";
		if (s === 'unanswered') return "Couldn't confidently answer from current knowledge. Try rephrasing your question.";
		if (s === 'error') return 'Something went wrong while generating a response. Please try again.';
		return `Response status: ${getStatusLabel(s)}.`;
	}

	function getContainerClass(s: string | undefined): string {
		if (s === 'off_topic') return 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30';
		if (s === 'unanswered') return 'bg-sky-50 text-sky-900 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:border-sky-500/30';
		if (s === 'error') return 'bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-500/30';
		return 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100';
	}

	function getBadgeClass(s: string | undefined): string {
		if (s === 'off_topic') return 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/20 dark:text-amber-100';
		if (s === 'unanswered') return 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-400/40 dark:bg-sky-400/20 dark:text-sky-100';
		if (s === 'error') return 'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-400/40 dark:bg-rose-400/20 dark:text-rose-100';
		return 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-500/40 dark:bg-slate-500/20 dark:text-slate-100';
	}

	function getDescriptionClass(s: string | undefined): string {
		if (s === 'off_topic') return 'text-amber-800 dark:text-amber-200/90';
		if (s === 'unanswered') return 'text-sky-800 dark:text-sky-200/90';
		if (s === 'error') return 'text-rose-800 dark:text-rose-200/90';
		return 'text-slate-700 dark:text-slate-300';
	}

	function getSuggestions(s: string | undefined): string[] {
		if (s === 'off_topic') return ['What can you help me with?', 'Tell me about yourself.'];
		return [];
	}
</script>

<div class="flex {role === 'user' ? 'justify-end' : 'justify-start'} mb-3">
	{#if role === 'user'}
		<p class="max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap bg-indigo-600 text-white">
			{content}
		</p>
	{:else}
		<div class="max-w-[85%] rounded-2xl px-3 py-2 text-sm {isNonAnswered(status) ? getContainerClass(status) : getContainerClass(undefined)}">
			{#if isNonAnswered(status)}
				<div class="mb-2 flex items-start gap-2">
					<span
						class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide {getBadgeClass(status)}"
						title={getStatusDescription(status)}
					>
						<svg viewBox="0 0 16 16" class="h-3 w-3" fill="none" aria-hidden="true">
							<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" />
							<path d="M8 7.1v3.3M8 5.2h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
						</svg>
						{getStatusLabel(status)}
					</span>
				</div>
				<p class="mb-2 text-[11px] leading-snug {getDescriptionClass(status)}">
					{getStatusDescription(status)}
				</p>
				{#if getSuggestions(status).length > 0 && onsuggestion}
					<div class="mb-2 flex flex-wrap gap-1.5">
						{#each getSuggestions(status) as suggestion}
							<button
								type="button"
								class="rounded-full border border-slate-300/80 bg-white/80 px-2 py-1 text-[11px] leading-tight text-slate-700 hover:bg-white dark:border-slate-500/60 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
								onclick={() => onsuggestion?.(suggestion)}
							>
								{suggestion}
							</button>
						{/each}
					</div>
				{/if}
			{/if}
			{#if content}
				<div class="chat-markdown break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:underline [&_a]:break-all [&_code]:text-[0.95em] [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5">
					{@html renderMarkdown(content)}
				</div>
			{:else if isStreaming}
				<span class="text-slate-500 dark:text-slate-400">Thinking...</span>
			{/if}
		</div>
	{/if}
</div>
