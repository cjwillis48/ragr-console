<script lang="ts">
	import { page } from '$app/state';
	import {
		acceptGeneratedPrompt,
		generateSampleMessages,
		getSystemPromptHistory,
		rollbackSystemPrompt,
		streamGenerateSystemPrompt
	} from '$lib/admin-api';
	import type { RagModel, SystemPromptHistoryEntry } from '$lib/admin-types';
	import { addToast } from '$lib/toast.svelte';

	let { model }: { model: RagModel } = $props();

	const slug = $derived(page.params.slug!);

	// System prompt magic generation
	let generatingPrompt = $state(false);
	let generatedPrompt = $state('');
	let generationInput = $state('');
	let showGeneratedPreview = $state(false);
	let promptHistory = $state<SystemPromptHistoryEntry[]>([]);
	let showPromptHistory = $state(false);
	let generatingSampleQuestions = $state(false);
	let newSampleQuestion = $state('');

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
</script>

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
											: 'border border-border bg-surface text-text-muted'}">{entry.source}</span
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
