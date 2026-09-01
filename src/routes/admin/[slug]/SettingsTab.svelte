<script lang="ts">
	import { page } from '$app/state';
	import { updateModel } from '$lib/admin-api';
	import type { RagModel, RagModelUpdate } from '$lib/admin-types';
	import { addToast } from '$lib/toast.svelte';
	import AccessSection from './AccessSection.svelte';
	import BehaviorSection from './BehaviorSection.svelte';
	import RetrievalSection from './RetrievalSection.svelte';

	let {
		model,
		hasContent,
		onSaved
	}: { model: RagModel; hasContent: boolean; onSaved: (m: RagModel) => void } = $props();

	const slug = $derived(page.params.slug!);

	let saving = $state(false);
	let saveSuccess = $state(false);

	// API key inputs (never populated from GET — write-only)
	let anthropicKeyInput = $state('');
	let voyageKeyInput = $state('');

	async function handleSave() {
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
			onSaved(await updateModel(slug, update));
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
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		handleSave();
	}}
	class="max-w-2xl space-y-6"
>
	<BehaviorSection {model} />
	<RetrievalSection {model} {hasContent} />
	<AccessSection {model} bind:anthropicKeyInput bind:voyageKeyInput />

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
