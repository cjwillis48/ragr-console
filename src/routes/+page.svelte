<script lang="ts">
	import { Show } from 'svelte-clerk';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { loadRagrWidgetBundle } from '$lib/load-ragr-widget-bundle';

	// Load the widget bundle on mount. The embeddable <ragr-chat> custom
	// element registers itself as a side effect and we mount it in inline
	// mode so it fills the hero card container.
	let widgetReady = $state(false);

	onMount(() => {
		if (!browser) return;
		void loadRagrWidgetBundle({
			warnMessage: '[ragr] landing page widget bundle failed to load'
		})
			.then(() => {
				widgetReady = true;
			})
			.catch(() => {});
	});
</script>

<svelte:head>
	<title>RAGr — RAG-as-a-Service for your apps</title>
	<meta
		name="description"
		content="Build AI assistants grounded in your own data. RAGr ingests your sources, manages retrieval and embeddings, and gives you a production-ready chat widget you can drop into any site in minutes."
	/>
	<meta property="og:title" content="RAGr — RAG-as-a-Service for your apps" />
	<meta
		property="og:description"
		content="Build AI assistants grounded in your own data. RAGr ingests your sources, manages retrieval and embeddings, and gives you a production-ready chat widget you can drop into any site in minutes."
	/>
	<meta property="og:url" content="https://ragr.dev/" />
	<meta name="twitter:title" content="RAGr — RAG-as-a-Service for your apps" />
	<meta
		name="twitter:description"
		content="Build AI assistants grounded in your own data. RAGr ingests your sources, manages retrieval and embeddings, and gives you a production-ready chat widget you can drop into any site in minutes."
	/>
	<link rel="canonical" href="https://ragr.dev/" />
</svelte:head>

<div class="flex min-h-dvh flex-col bg-surface text-text">
	<!-- Nav -->
	<nav class="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
		<a href="/" class="text-xl font-bold tracking-tight">
			RAG<span class="text-accent">r</span>
		</a>
		<div class="flex items-center gap-3">
			<a
				href="/demos"
				class="px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text"
			>
				Demos
			</a>
			<Show when="signed-in">
				{#snippet children()}
					<a
						href="/admin"
						class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
					>
						Console
					</a>
				{/snippet}
				{#snippet fallback()}
					<a
						href="/sign-in"
						class="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-accent/50 hover:text-text"
					>
						Sign In
					</a>
				{/snippet}
			</Show>
		</div>
	</nav>

	<!-- Hero -->
	<main class="relative flex flex-1 items-center justify-center overflow-hidden px-6">
		<!-- Glow -->
		<div
			class="pointer-events-none absolute top-1/2 left-1/2 h-150 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/8 blur-[120px]"
		></div>

		<div
			class="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 py-16 lg:grid-cols-2 lg:gap-16 lg:py-0"
		>
			<!-- Text -->
			<div>
				<h1 class="mb-6 text-5xl leading-[1.1] font-bold tracking-tight sm:text-6xl lg:text-7xl">
					RAG-as-a-Service<br />
					<span class="text-accent">for your apps</span>
				</h1>

				<p class="mb-10 max-w-xl text-lg leading-relaxed text-text-muted sm:text-xl">
					Build AI assistants grounded in your data. Ready to embed in minutes.
				</p>

				<div class="flex flex-col gap-4 sm:flex-row">
					<a
						href="/sign-up"
						class="rounded-lg bg-accent px-8 py-3 text-center text-base font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent/90 hover:shadow-accent/30"
					>
						Get Started
					</a>
					<a
						href="#features"
						class="rounded-lg border border-border px-8 py-3 text-center text-base font-semibold text-text-muted transition-colors hover:border-accent/50 hover:text-text"
					>
						See Features
					</a>
				</div>
			</div>

			<!-- Live widget -->
			<!--
				Marketing-page demo of the real embeddable widget, in inline mode
				so it fills the hero card instead of floating in the corner. Same
				<ragr-chat> custom element that customers embed on their own sites
				— this is both a demo and a dogfood of the new build. The bundle
				is loaded once on mount via the script in the component script.
			-->
			<div class="flex justify-center lg:justify-end">
				<div
					class="h-137.5 w-full max-w-100 overflow-hidden rounded-xl border border-border shadow-2xl shadow-accent/5"
				>
					{#if widgetReady}
						<ragr-chat slug="ragr-landing-page" inline open></ragr-chat>
					{:else}
						<div class="flex h-full items-center justify-center text-sm text-text-muted">
							Loading…
						</div>
					{/if}
				</div>
			</div>
		</div>
	</main>

	<!-- Features -->
	<section id="features" class="mx-auto w-full max-w-6xl px-6 py-24">
		<h2 class="mb-4 text-center text-3xl font-bold sm:text-4xl">Everything you need</h2>
		<p class="mx-auto mb-16 max-w-lg text-center text-text-muted">
			A complete RAG platform so you can focus on your product, not your infrastructure.
		</p>

		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
			<div
				class="group rounded-xl border border-border bg-surface-alt p-6 transition-colors hover:border-accent/40"
			>
				<div
					class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect x="3" y="3" width="7" height="7" rx="1" />
						<rect x="14" y="3" width="7" height="7" rx="1" />
						<rect x="3" y="14" width="7" height="7" rx="1" />
						<rect x="14" y="14" width="7" height="7" rx="1" />
					</svg>
				</div>
				<h3 class="mb-2 font-semibold">Your data, fully isolated</h3>
				<p class="text-sm leading-relaxed text-text-muted">
					Every model gets its own knowledge base and personality. Your customers' data never
					crosses boundaries.
				</p>
			</div>

			<div
				class="group rounded-xl border border-border bg-surface-alt p-6 transition-colors hover:border-accent/40"
			>
				<div
					class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
						<path d="M12 12v9" />
						<path d="m8 17 4-5 4 5" />
					</svg>
				</div>
				<h3 class="mb-2 font-semibold">Add your sources, we handle the rest</h3>
				<p class="text-sm leading-relaxed text-text-muted">
					Point us at your content and we chunk, embed, and index it. Your AI assistant is ready in
					minutes, not weeks.
				</p>
			</div>

			<div
				class="group rounded-xl border border-border bg-surface-alt p-6 transition-colors hover:border-accent/40"
			>
				<div
					class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
				</div>
				<h3 class="mb-2 font-semibold">Embed in one click</h3>
				<p class="text-sm leading-relaxed text-text-muted">
					Drop a chat widget into any site with a single line of code. Themed to your brand, ready
					to go.
				</p>
			</div>

			<div
				class="group rounded-xl border border-border bg-surface-alt p-6 transition-colors hover:border-accent/40"
			>
				<div
					class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="16 18 22 12 16 6" />
						<polyline points="8 6 2 12 8 18" />
					</svg>
				</div>
				<h3 class="mb-2 font-semibold">Simple API</h3>
				<p class="text-sm leading-relaxed text-text-muted">
					One REST endpoint, real-time streaming, no SDK. Build exactly the experience you want, in
					any language.
				</p>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer
		class="mx-auto flex w-full max-w-6xl items-center justify-between border-t border-border px-6 py-8 text-sm text-text-muted"
	>
		<span>RAG<span class="text-accent">r</span></span>
		<span>&copy; {new Date().getFullYear()}</span>
	</footer>
</div>
