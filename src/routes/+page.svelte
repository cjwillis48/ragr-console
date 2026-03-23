<script lang="ts">
	import { Show } from 'svelte-clerk';
</script>

<svelte:head>
	<title>RAGr — RAG-as-a-Service for your apps</title>
	<meta name="description" content="Build AI assistants grounded in your data. Ready to embed in minutes." />
</svelte:head>

<div class="min-h-dvh bg-surface text-text flex flex-col">
	<!-- Nav -->
	<nav class="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
		<a href="/" class="text-xl font-bold tracking-tight">
			RAG<span class="text-accent">r</span>
		</a>
		<div>
			<Show when="signed-in">
				{#snippet children()}
					<a
						href="/admin"
						class="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
					>
						Console
					</a>
				{/snippet}
				{#snippet fallback()}
					<a
						href="/sign-in"
						class="px-4 py-2 text-sm font-medium rounded-lg border border-border text-text-muted hover:text-text hover:border-accent/50 transition-colors"
					>
						Sign In
					</a>
				{/snippet}
			</Show>
		</div>
	</nav>

	<!-- Hero -->
	<main class="flex-1 flex items-center justify-center px-6 relative overflow-hidden">
		<!-- Glow -->
		<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-accent/8 rounded-full blur-[120px] pointer-events-none"></div>

		<div class="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16 lg:py-0">
			<!-- Text -->
			<div>
				<h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
					RAG-as-a-Service<br />
					<span class="text-accent">for your apps</span>
				</h1>

				<p class="text-lg sm:text-xl text-text-muted max-w-xl mb-10 leading-relaxed">
					Build AI assistants grounded in your data. Ready to embed in minutes.
				</p>

				<div class="flex flex-col sm:flex-row gap-4">
					<a
						href="/sign-up"
						class="px-8 py-3 text-base font-semibold rounded-lg bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all text-center"
					>
						Get Started
					</a>
					<a
						href="#features"
						class="px-8 py-3 text-base font-semibold rounded-lg border border-border text-text-muted hover:text-text hover:border-accent/50 transition-colors text-center"
					>
						See Features
					</a>
				</div>
			</div>

			<!-- Live widget -->
			<div class="flex justify-center lg:justify-end">
				<div class="w-full max-w-100 h-137.5 rounded-xl overflow-hidden border border-border shadow-2xl shadow-accent/5">
					<iframe
						src="https://ragr.charliewillis.com/chat/ragr-landing-page/embed?expanded"
						title="RAGr demo chat widget"
						sandbox="allow-scripts allow-same-origin allow-forms"
						class="w-full h-full border-none"
					></iframe>
				</div>
			</div>
		</div>
	</main>

	<!-- Features -->
	<section id="features" class="w-full max-w-6xl mx-auto px-6 py-24">
		<h2 class="text-3xl sm:text-4xl font-bold text-center mb-4">Everything you need</h2>
		<p class="text-text-muted text-center mb-16 max-w-lg mx-auto">
			A complete RAG platform so you can focus on your product, not your infrastructure.
		</p>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
			<div class="group rounded-xl border border-border bg-surface-alt p-6 hover:border-accent/40 transition-colors">
				<div class="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-4">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<rect x="3" y="3" width="7" height="7" rx="1" />
						<rect x="14" y="3" width="7" height="7" rx="1" />
						<rect x="3" y="14" width="7" height="7" rx="1" />
						<rect x="14" y="14" width="7" height="7" rx="1" />
					</svg>
				</div>
				<h3 class="font-semibold mb-2">Your data, fully isolated</h3>
				<p class="text-sm text-text-muted leading-relaxed">
					Every model gets its own knowledge base and personality. Your customers' data never crosses boundaries.
				</p>
			</div>

			<div class="group rounded-xl border border-border bg-surface-alt p-6 hover:border-accent/40 transition-colors">
				<div class="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-4">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
						<path d="M12 12v9" />
						<path d="m8 17 4-5 4 5" />
					</svg>
				</div>
				<h3 class="font-semibold mb-2">Add your sources, we handle the rest</h3>
				<p class="text-sm text-text-muted leading-relaxed">
					Point us at your content and we chunk, embed, and index it. Your AI assistant is ready in minutes, not weeks.
				</p>
			</div>

			<div class="group rounded-xl border border-border bg-surface-alt p-6 hover:border-accent/40 transition-colors">
				<div class="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-4">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
				</div>
				<h3 class="font-semibold mb-2">Embed in one click</h3>
				<p class="text-sm text-text-muted leading-relaxed">
					Drop a chat widget into any site with a single line of code. Themed to your brand, ready to go.
				</p>
			</div>

			<div class="group rounded-xl border border-border bg-surface-alt p-6 hover:border-accent/40 transition-colors">
				<div class="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-4">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="16 18 22 12 16 6" />
						<polyline points="8 6 2 12 8 18" />
					</svg>
				</div>
				<h3 class="font-semibold mb-2">Simple API</h3>
				<p class="text-sm text-text-muted leading-relaxed">
					One REST endpoint, real-time streaming, no SDK. Build exactly the experience you want, in any language.
				</p>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="w-full max-w-6xl mx-auto px-6 py-8 border-t border-border flex items-center justify-between text-sm text-text-muted">
		<span>RAG<span class="text-accent">r</span></span>
		<span>&copy; {new Date().getFullYear()}</span>
	</footer>
</div>
