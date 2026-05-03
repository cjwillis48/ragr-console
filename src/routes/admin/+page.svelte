<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { listModels, createModel, deleteModel } from '$lib/admin-api';
	import { currentUser } from '$lib/current-user.svelte';
	import type { RagModel, RagModelCreate } from '$lib/admin-types';

	let models = $state<RagModel[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showCreate = $state(false);
	let newName = $state('');
	let newSlug = $state('');
	let newAnthropicKey = $state('');
	let newVoyageKey = $state('');
	let creating = $state(false);

	let requiresByok = $derived(currentUser.requiresByok);
	let byokComplete = $derived(newAnthropicKey.trim().length > 0 && newVoyageKey.trim().length > 0);
	let canSubmit = $derived(
		newName.trim().length > 0 && newSlug.trim().length > 0 && (!requiresByok || byokComplete)
	);

	onMount(() => load());

	async function load() {
		loading = true;
		error = null;
		try {
			models = await listModels();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to load models';
		} finally {
			loading = false;
		}
	}

	async function handleCreate() {
		if (!canSubmit) return;
		creating = true;
		try {
			const body: RagModelCreate = { name: newName.trim(), slug: newSlug.trim() };
			if (newAnthropicKey.trim()) body.custom_anthropic_key = newAnthropicKey.trim();
			if (newVoyageKey.trim()) body.custom_voyage_key = newVoyageKey.trim();
			await createModel(body);
			showCreate = false;
			newName = '';
			newSlug = '';
			newAnthropicKey = '';
			newVoyageKey = '';
			await load();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to create model';
		} finally {
			creating = false;
		}
	}

	async function handleDelete(slug: string) {
		if (!confirm(`Delete model "${slug}"? This cannot be undone.`)) return;
		try {
			await deleteModel(slug);
			await load();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to delete model';
		}
	}

	function slugify(name: string) {
		return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	}
</script>

<svelte:head><title>RAGr Admin</title></svelte:head>

<div class="flex items-center justify-between mb-6">
	<h1 class="text-2xl font-semibold">Models</h1>
	<button
		onclick={() => (showCreate = !showCreate)}
		class="rounded-lg bg-accent px-4 py-2 text-sm text-white font-medium hover:bg-accent/90"
	>
		{showCreate ? 'Cancel' : 'New Model'}
	</button>
</div>

{#if error}
	<div class="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-sm text-error mb-4">
		{error}
	</div>
{/if}

{#if showCreate}
	<form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="bg-surface-alt border border-border rounded-lg p-4 mb-6 space-y-3">
		{#if requiresByok}
			<div class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
				<div class="font-medium">Your account requires its own API keys.</div>
				<div class="text-amber-200/80 mt-1">
					New accounts must provide an Anthropic and a Voyage key. Get them at
					<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" class="underline hover:text-amber-100">console.anthropic.com</a>
					and
					<a href="https://dashboard.voyageai.com/api-keys" target="_blank" rel="noopener" class="underline hover:text-amber-100">dashboard.voyageai.com</a>.
					Keys are encrypted at rest.
				</div>
			</div>
		{/if}
		<div>
			<label for="name" class="block text-sm text-text-muted mb-1">Name</label>
			<input
				id="name"
				bind:value={newName}
				oninput={() => (newSlug = slugify(newName))}
				placeholder="My Model"
				class="w-full rounded-lg bg-surface border border-border px-3 py-2 text-text
					placeholder:text-text-muted focus:outline-none focus:border-accent"
			/>
		</div>
		<div>
			<label for="slug" class="block text-sm text-text-muted mb-1">Slug</label>
			<input
				id="slug"
				bind:value={newSlug}
				placeholder="my-model"
				class="w-full rounded-lg bg-surface border border-border px-3 py-2 text-text
					placeholder:text-text-muted focus:outline-none focus:border-accent"
			/>
		</div>

		<details open={requiresByok} class="group">
			<summary class="cursor-pointer text-sm text-text-muted select-none flex items-center gap-2">
				<span class="group-open:rotate-90 transition-transform inline-block">›</span>
				API keys {requiresByok ? '(required)' : '(optional — uses platform keys if blank)'}
			</summary>
			<div class="mt-3 space-y-3">
				<div>
					<label for="anthropic_key" class="block text-sm text-text-muted mb-1">
						Anthropic API key{requiresByok ? ' *' : ''}
					</label>
					<input
						id="anthropic_key"
						type="password"
						bind:value={newAnthropicKey}
						placeholder="sk-ant-..."
						autocomplete="off"
						class="w-full rounded-lg bg-surface border border-border px-3 py-2 text-text font-mono text-sm
							placeholder:text-text-muted focus:outline-none focus:border-accent"
					/>
				</div>
				<div>
					<label for="voyage_key" class="block text-sm text-text-muted mb-1">
						Voyage API key{requiresByok ? ' *' : ''}
					</label>
					<input
						id="voyage_key"
						type="password"
						bind:value={newVoyageKey}
						placeholder="pa-..."
						autocomplete="off"
						class="w-full rounded-lg bg-surface border border-border px-3 py-2 text-text font-mono text-sm
							placeholder:text-text-muted focus:outline-none focus:border-accent"
					/>
				</div>
			</div>
		</details>

		<button
			type="submit"
			disabled={creating || !canSubmit}
			class="rounded-lg bg-accent px-4 py-2 text-sm text-white font-medium hover:bg-accent/90
				disabled:opacity-40 disabled:cursor-not-allowed"
		>
			{creating ? 'Creating...' : 'Create'}
		</button>
	</form>
{/if}

{#if loading}
	<div class="text-text-muted">Loading...</div>
{:else if models.length === 0}
	<div class="text-text-muted">No models yet. Create one to get started.</div>
{:else}
	<div class="grid grid-cols-1 gap-4">
		{#each models as model}
			<a
				href="/admin/{model.slug}"
				class="group relative block bg-surface-alt border border-border rounded-lg p-4 pr-36
					hover:border-accent/40 transition-colors cursor-pointer no-underline text-inherit min-w-0"
			>
				<div class="flex items-center gap-2 sm:gap-3 min-w-0">
					<h2 class="font-medium truncate min-w-0">{model.name}</h2>
					<span class="hidden sm:inline text-xs text-text-muted font-mono truncate">/{model.slug}</span>
					{#if !model.is_active}
						<span class="text-xs bg-text-muted/10 text-text-muted px-2 py-0.5 rounded shrink-0">inactive</span>
					{/if}
				</div>
				{#if model.description}
					<p class="text-sm text-text-muted mt-1 truncate">{model.description}</p>
				{/if}

				<!-- Action icons — top-right, stop propagation so they don't trigger card navigation -->
				<span class="absolute top-3 right-3 flex items-center gap-1">
					<button
						onclick={(e) => { e.preventDefault(); e.stopPropagation(); window.open('/chat/' + model.slug, '_blank'); }}
						class="w-11 h-11 inline-flex items-center justify-center rounded-md
							text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
						aria-label="Chat with {model.name}"
						title="Open chat"
					>
						<svg viewBox="0 0 16 16" class="w-4 h-4" fill="none" aria-hidden="true">
							<path d="M5.5 7h5M5.5 9.5h3M8 2C4.68 2 2 4.4 2 7.3c0 1.35.56 2.58 1.49 3.53L3 14l2.72-1.27c.7.18 1.47.27 2.28.27 3.32 0 6-2.4 6-5.3S11.32 2 8 2z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
					<button
						onclick={(e) => { e.preventDefault(); e.stopPropagation(); goto('/admin/' + model.slug); }}
						class="w-11 h-11 inline-flex items-center justify-center rounded-md
							text-text-muted hover:text-text hover:bg-white/5 transition-colors"
						aria-label="Edit {model.name}"
						title="Edit settings"
					>
						<svg viewBox="0 0 16 16" class="w-4 h-4" fill="none" aria-hidden="true">
							<path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
							<path d="M9.5 3.5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
						</svg>
					</button>
					<button
						onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(model.slug); }}
						class="w-11 h-11 inline-flex items-center justify-center rounded-md
							text-text-muted hover:text-error hover:bg-error/10 transition-colors"
						aria-label="Delete {model.name}"
						title="Delete"
					>
						<svg viewBox="0 0 16 16" class="w-4 h-4" fill="none" aria-hidden="true">
							<path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
						</svg>
					</button>
				</span>
			</a>
		{/each}
	</div>
{/if}
