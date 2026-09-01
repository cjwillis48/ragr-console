<script lang="ts">
	import type { RagModel } from '$lib/admin-types';
	import { currentUser } from '$lib/current-user.svelte';

	let {
		model,
		anthropicKeyInput = $bindable(''),
		voyageKeyInput = $bindable('')
	}: { model: RagModel; anthropicKeyInput?: string; voyageKeyInput?: string } = $props();

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
</script>

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
			RAGr uses your Anthropic key for chat completions and your Voyage key for embedding sources.
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
					placeholder={model.has_custom_anthropic_key ? 'Enter new key to replace' : 'sk-ant-...'}
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
