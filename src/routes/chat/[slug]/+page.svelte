<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { loadRagrWidgetBundle } from '$lib/load-ragr-widget-bundle';

	// Full-page hosted chat. This route renders a full-viewport chat surface
	// for customers who want a standalone chat page rather than an embedded
	// widget. It mounts the same <ragr-chat> custom element used by the
	// embed loader, in `inline open` mode so it fills the viewport without
	// the floating launcher.
	//
	// The widget itself handles fetchModelInfo + fetchTheme + streaming.
	// If the model slug is invalid the widget silently renders nothing and
	// logs a warning; consider adding a +page.server.ts preload that 404s
	// on unknown slugs if that becomes a visible problem for hosted_chat.
	//
	// Bundle load: see $lib/load-ragr-widget-bundle (script inject, not import()).
	const slug = $derived(page.params.slug!);
	let widgetReady = $state(false);

	onMount(() => {
		if (!browser) return;
		void loadRagrWidgetBundle()
			.then(() => {
				widgetReady = true;
			})
			.catch(() => {});
	});
</script>

<svelte:head>
	<title>Chat</title>
</svelte:head>

<div class="fullpage-chat">
	{#if widgetReady}
		<ragr-chat {slug} inline open></ragr-chat>
	{:else}
		<div class="loading">Loading…</div>
	{/if}
</div>

<style>
	.fullpage-chat {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100dvh;
		background: #0f172a;
	}
	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: #94a3b8;
		font-family: system-ui, sans-serif;
	}
	ragr-chat {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
