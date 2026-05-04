<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { loadRagrWidgetBundle } from '$lib/load-ragr-widget-bundle';

	let { data } = $props();
	let widgetReady = $state(false);

	// Always derive from URL — clicking a sidebar item navigates via goto(),
	// which updates page.params.slug, which updates this. No local state.
	const selectedSlug = $derived(
		page.params.slug || data.models[0]?.slug || null
	);

	function selectModel(slug: string) {
		if (slug === selectedSlug) return;
		goto(`/demos/${slug}`, { replaceState: false, noScroll: true });
	}

	onMount(() => {
		if (!browser) return;
		void loadRagrWidgetBundle()
			.then(() => { widgetReady = true; })
			.catch(() => {});
	});
</script>

<svelte:head>
	<title>{data.models.find(m => m.slug === selectedSlug)?.name || 'Demos'} — RAGr Demos</title>
</svelte:head>

{#if data.models.length === 0}
	<div class="empty">
		<p>No demos available yet.</p>
	</div>
{:else}
	<!-- Desktop: sidebar + chat. Mobile: dropdown + chat. -->
	<div class="demos-layout">
		<!-- Sidebar (desktop) -->
		<nav class="sidebar" aria-label="Demo models">
			<div class="sidebar-header">
				<a href="/" class="brand">RAG<span class="brand-accent">r</span></a>
				<span class="sidebar-title">Demos</span>
			</div>
			{#each data.models as model}
				<button
					class="sidebar-item"
					class:active={model.slug === selectedSlug}
					onclick={() => selectModel(model.slug)}
				>
					<span class="sidebar-name">{model.name}</span>
					{#if model.description}
						<span class="sidebar-desc">{model.description}</span>
					{/if}
				</button>
			{/each}
		</nav>

		<!-- Dropdown (mobile) -->
		<div class="mobile-bar">
			<a href="/" class="brand">RAG<span class="brand-accent">r</span></a>
			<select
				class="mobile-select"
				value={selectedSlug}
				onchange={(e) => selectModel(e.currentTarget.value)}
			>
				{#each data.models as model}
					<option value={model.slug}>{model.name}</option>
				{/each}
			</select>
		</div>

		<!-- Chat panel -->
		<main class="chat-panel">
			{#if widgetReady && selectedSlug}
				{#key selectedSlug}
					<ragr-chat slug={selectedSlug} inline open></ragr-chat>
				{/key}
			{:else}
				<div class="loading">Loading…</div>
			{/if}
		</main>
	</div>
{/if}

<style>
	/* Full viewport, no page scroll */
	:global(body) {
		overflow: hidden;
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100dvh;
		color: #94a3b8;
		font-family: system-ui, sans-serif;
		background: #0f172a;
	}

	.demos-layout {
		display: flex;
		height: 100dvh;
		background: #0f172a;
		color: #e2e8f0;
		font-family: system-ui, -apple-system, sans-serif;
	}

	/* ---- Sidebar (desktop) ---- */
	.sidebar {
		width: 280px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		overflow-y: auto;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.brand {
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: inherit;
		text-decoration: none;
	}
	.brand-accent { color: #6366f1; }

	.sidebar-title {
		font-size: 0.8rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #64748b;
	}

	.sidebar-item {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.75rem 1.25rem;
		border: none;
		background: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
		border-left: 3px solid transparent;
		transition: background 160ms ease, border-color 160ms ease;
		font: inherit;
	}
	.sidebar-item:hover {
		background: rgba(255, 255, 255, 0.04);
	}
	.sidebar-item.active {
		background: rgba(99, 102, 241, 0.08);
		border-left-color: #6366f1;
	}

	.sidebar-name {
		font-size: 0.9rem;
		font-weight: 600;
	}
	.sidebar-desc {
		font-size: 0.75rem;
		color: #94a3b8;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* ---- Mobile bar ---- */
	.mobile-bar {
		display: none;
	}

	.mobile-select {
		flex: 1;
		appearance: none;
		background-color: #1e293b;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none'><path d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
		background-size: 0.75rem;
		color: #e2e8f0;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		padding: 0.5rem 2.25rem 0.5rem 0.75rem;
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}

	/* ---- Chat panel ---- */
	.chat-panel {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.chat-panel ragr-chat {
		display: block;
		width: 100%;
		height: 100%;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		color: #94a3b8;
	}

	/* ---- Mobile ---- */
	@media (max-width: 960px) {
		.demos-layout {
			flex-direction: column;
		}
		.sidebar {
			display: none;
		}
		.mobile-bar {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			padding: 0.625rem 1rem;
			border-bottom: 1px solid rgba(255, 255, 255, 0.06);
			flex-shrink: 0;
		}
	}
</style>
