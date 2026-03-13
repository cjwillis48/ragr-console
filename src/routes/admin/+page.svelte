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
			<div class="bg-surface-alt border border-border rounded-lg p-4 flex items-center justify-between hover:border-border/80 transition-colors">
				<a href="/admin/{model.slug}" class="flex-1 min-w-0">
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
				</a>
				<button
					onclick={() => handleDelete(model.slug)}
					class="text-sm text-text-muted hover:text-error ml-4 shrink-0"
				>
					Delete
				</button>
			</div>
		{/each}
	</div>
{/if}
