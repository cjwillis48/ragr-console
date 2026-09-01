<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getModel } from '$lib/admin-api';
	import type { RagModel } from '$lib/admin-types';
	import { addToast } from '$lib/toast.svelte';
	import ApiKeysTab from './ApiKeysTab.svelte';
	import ConversationsTab from './ConversationsTab.svelte';
	import SettingsTab from './SettingsTab.svelte';
	import SourcesTab from './SourcesTab.svelte';
	import StatsTab from './StatsTab.svelte';
	import WidgetTab from './WidgetTab.svelte';

	const slug = $derived(page.params.slug!);

	type Tab = 'settings' | 'widget' | 'sources' | 'conversations' | 'api-keys' | 'stats';

	let model = $state<RagModel | null>(null);
	let sourcesTotal = $state(0);

	// Locks chunk-size / chunk-overlap / embedding-model controls. `model.has_content` is
	// the server's view at load time; `sourcesTotal > 0` covers sources added in this
	// session before the model is reloaded. Without the OR, those controls would stay
	// enabled until refresh after the first source is added.
	const hasContent = $derived(!!model?.has_content || sourcesTotal > 0);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	const validTabs: Tab[] = ['settings', 'widget', 'sources', 'conversations', 'api-keys', 'stats'];
	function getInitialTab(): Tab {
		if (typeof window === 'undefined') return 'settings';
		const hash = window.location.hash.slice(1) as Tab;
		return validTabs.includes(hash) ? hash : 'settings';
	}
	let activeTab = $state<Tab>(getInitialTab());

	onMount(() => {
		loadModel();
	});

	async function loadModel() {
		loading = true;
		loadError = null;
		try {
			model = await getModel(slug);
		} catch (e: unknown) {
			loadError = e instanceof Error ? e.message : 'Failed to load model';
		} finally {
			loading = false;
		}
	}

	// Each tab component fetches its own data when it mounts, so switching tabs
	// is just a render — no loader to coordinate here.
	function selectTab(tab: Tab) {
		activeTab = tab;
		window.location.hash = tab;
	}

	const tabs: { key: Tab; label: string }[] = [
		{ key: 'settings', label: 'Settings' },
		{ key: 'widget', label: 'Widget' },
		{ key: 'sources', label: 'Sources' },
		{ key: 'conversations', label: 'Conversations' },
		{ key: 'api-keys', label: 'RAGr API Keys' },
		{ key: 'stats', label: 'Stats' }
	];
</script>

<svelte:head>
	<title>{model?.name ?? 'Model'} - Admin</title>
</svelte:head>

{#if loading}
	<div class="text-text-muted">Loading...</div>
{:else if !model}
	<div class="text-text-muted">Model not found.</div>
{:else}
	<div class="mb-3">
		<a href="/admin" class="text-sm text-text-muted hover:text-accent">&larr; All Models</a>
		<div class="mt-1 flex flex-wrap items-center gap-3">
			<h1 class="text-2xl font-semibold">{model.name}</h1>
			<span class="font-mono text-sm text-text-muted">/{model.slug}</span>
			<a
				href="/chat/{model.slug}"
				target="_blank"
				rel="noopener"
				title="Open chat in a new tab"
				class="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-alt px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-accent hover:text-text"
			>
				<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
					<path
						d="M3 4h7v2H5v6h6V8h2v5a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm6-2h5v5h-2V4.4l-5.3 5.3-1.4-1.4L10.6 3H9V2z"
						fill="currentColor"
					/>
				</svg>
				Chat with this bot
			</a>
		</div>
	</div>

	<!-- Tabs -->
	<div
		class="mb-4 flex gap-1 overflow-x-auto border-b border-border"
		style="-ms-overflow-style:none;scrollbar-width:none;"
	>
		{#each tabs as tab}
			<button
				onclick={() => selectTab(tab.key)}
				class="shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:px-4 {activeTab ===
				tab.key
					? 'border-accent text-accent'
					: 'border-transparent text-text-muted hover:text-text'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if loadError}
		<div class="mb-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
			{loadError}
		</div>
	{/if}

	<!-- Settings Tab -->
	{#if activeTab === 'settings'}
		<SettingsTab {model} {hasContent} onSaved={(m) => (model = m)} />
	{:else if activeTab === 'widget'}
		<WidgetTab {model} />
	{:else if activeTab === 'sources'}
		<SourcesTab bind:sourcesTotal />
	{:else if activeTab === 'conversations'}
		<ConversationsTab />
	{:else if activeTab === 'api-keys'}
		<ApiKeysTab {model} />
	{:else if activeTab === 'stats'}
		<StatsTab />
	{/if}
{/if}
