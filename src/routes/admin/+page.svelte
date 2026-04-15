<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { listModels, createModel, deleteModel } from '$lib/admin-api';
	import type { RagModel } from '$lib/admin-types';

	let models = $state<RagModel[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showCreate = $state(false);
	let newName = $state('');
	let newSlug = $state('');
	let creating = $state(false);

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
		if (!newName.trim() || !newSlug.trim()) return;
		creating = true;
		try {
			await createModel({ name: newName.trim(), slug: newSlug.trim() });
			showCreate = false;
			newName = '';
			newSlug = '';
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
		<button
			type="submit"
			disabled={creating || !newName.trim() || !newSlug.trim()}
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
	<div class="grid gap-4">
		{#each models as model}
			<a
				href="/admin/{model.slug}"
				class="group relative block bg-surface-alt border border-border rounded-lg p-4 pr-32
					hover:border-accent/40 transition-colors cursor-pointer no-underline text-inherit"
			>
				<div class="flex items-center gap-3">
					<h2 class="font-medium truncate">{model.name}</h2>
					<span class="text-xs text-text-muted font-mono">/{model.slug}</span>
					{#if !model.is_active}
						<span class="text-xs bg-error/20 text-error px-2 py-0.5 rounded">inactive</span>
					{/if}
				</div>
				{#if model.description}
					<p class="text-sm text-text-muted mt-1 truncate">{model.description}</p>
				{/if}

				<!-- Action icons — top-right, stop propagation so they don't trigger card navigation -->
				<span class="absolute top-3 right-3 flex items-center gap-0.5">
					<button
						onclick={(e) => { e.preventDefault(); e.stopPropagation(); window.open('/chat/' + model.slug, '_blank'); }}
						class="w-9 h-9 inline-flex items-center justify-center rounded-md
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
						class="w-9 h-9 inline-flex items-center justify-center rounded-md
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
						class="w-9 h-9 inline-flex items-center justify-center rounded-md
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
