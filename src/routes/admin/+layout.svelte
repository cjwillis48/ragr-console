<script lang="ts">
	import { UserButton } from 'svelte-clerk';
	import { useClerkContext } from 'svelte-clerk/client';
	import { setTokenGetter } from '$lib/admin-api';
	import { currentUser } from '$lib/current-user.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();

	const ctx = useClerkContext();

	// Set immediately — the getter is lazy, so it's fine even before isLoaded.
	// The actual getToken() call only happens when an API call is made,
	// and children don't render until isLoaded is true.
	setTokenGetter(() => ctx.clerk?.session?.getToken() ?? Promise.resolve(null));

	let ready = $derived(ctx.isLoaded);

	$effect(() => {
		if (ready && !currentUser.loaded) {
			currentUser.load();
		}
	});
</script>

<svelte:head>
	<!-- Admin is auth-gated, but search engines should not index the surface
	     even if it ever leaks (e.g. error pages rendered before the gate). -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-dvh bg-surface text-text overflow-x-hidden">
	<header class="border-b border-border px-4 py-3">
		<div class="max-w-5xl mx-auto flex items-center justify-between">
			<a href="/admin" class="text-lg font-semibold hover:text-accent transition-colors">RAGr Admin</a>
			<UserButton />
		</div>
	</header>
	<main class="max-w-5xl mx-auto px-4 py-6">
		{#if ready}
			{@render children()}
		{:else}
			<div class="text-text-muted">Loading...</div>
		{/if}
	</main>
	<footer class="max-w-5xl mx-auto px-4 py-6 border-t border-border text-center text-sm text-text-muted">
		Bug or feature request? <a href="mailto:contact@ragr.dev" class="hover:text-accent transition-colors">contact@ragr.dev</a>
	</footer>
</div>
<Toast />
