<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getTheme, updateTheme } from '$lib/admin-api';
	import type { RagModel, WidgetTheme } from '$lib/admin-types';
	import { addToast } from '$lib/toast.svelte';
	import { loadRagrWidgetBundle } from '$lib/load-ragr-widget-bundle';
	import { ALLOWED_FONT_FAMILIES, SYSTEM_FONTS } from '$lib/font-allowlist';

	let { model }: { model: RagModel } = $props();

	const slug = $derived(page.params.slug!);
	let themeSuccess = $state(false);

	// Widget theme
	let theme = $state<WidgetTheme>({});
	let savingTheme = $state(false);
	let embedCopiedInTab = $state(false);

	// Live widget preview wiring. The admin page hosts a real <ragr-chat>
	// element in inline mode and pushes the current (possibly unsaved) theme
	// state to it via the element's imperative `themeOverride` property. The
	// widget merges those values over whatever it fetched from the backend
	// so the preview updates instantly as the admin drags color pickers
	// without requiring a save round-trip.
	let widgetPreviewEl = $state<HTMLElement | null>(null);
	let widgetBundleLoaded = $state(false);
	let widgetBundleError = $state<string | null>(null);

	async function ensureWidgetBundle(): Promise<void> {
		if (widgetBundleLoaded) return;
		if (typeof window === 'undefined') return;
		try {
			await loadRagrWidgetBundle();
			widgetBundleLoaded = true;
		} catch {
			widgetBundleError = 'Failed to load widget bundle';
			throw new Error('widget bundle load failed');
		}
	}

	// Push the current in-memory theme to the widget element whenever it
	// changes. The widget reads this as a Partial<WidgetTheme> and merges it
	// over its own fetched theme. Cleared when the element is unmounted.
	$effect(() => {
		if (!widgetPreviewEl) return;
		(
			widgetPreviewEl as HTMLElement & {
				themeOverride: Partial<WidgetTheme> | null;
			}
		).themeOverride = { ...theme };
	});
	let fontDropdownOpen = $state(false);
	let fontFilterActive = $state(false);
	const googleFontUrl =
		'https://fonts.googleapis.com/css2?family=' +
		ALLOWED_FONT_FAMILIES.filter((f) => !SYSTEM_FONTS.has(f))
			.map((f) => f.replace(/ /g, '+'))
			.join('&family=') +
		'&display=swap';

	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (fontDropdownOpen && !target.closest('.font-dropdown-wrapper')) {
			fontDropdownOpen = false;
		}
	}
	let launcherHintText = $derived(theme.launcher_hint?.trim() || '');

	function themeColor(key: string, fallback: string): string {
		return (theme[key as keyof WidgetTheme] as string) ?? fallback;
	}

	function setThemeColor(key: string, e: Event) {
		theme = { ...theme, [key]: (e.target as HTMLInputElement).value };
	}

	function getEmbedSnippet(): string {
		return `<script src="${location.origin}/chat/${model.slug}/loader.js"><\/script>`;
	}

	async function copyEmbedInTab() {
		await navigator.clipboard.writeText(getEmbedSnippet());
		embedCopiedInTab = true;
		setTimeout(() => (embedCopiedInTab = false), 2000);
	}
	const THEME_DEFAULTS: Record<string, string | number | boolean> = {
		primary_color: '#6366f1',
		bg_color: '#0f172a',
		text_color: '#e2e8f0',
		user_bubble_color: '#4f46e5',
		bot_bubble_color: '#1e293b',
		border_radius: 12,
		show_sample_messages_in_greeting: true
	};

	async function handleSaveTheme() {
		savingTheme = true;
		// Fill in defaults for any unset fields so all values are always sent
		const payload = { ...theme };
		for (const [key, fallback] of Object.entries(THEME_DEFAULTS)) {
			if (payload[key as keyof typeof payload] == null) {
				(payload as Record<string, unknown>)[key] = fallback;
			}
		}
		try {
			theme = await updateTheme(slug, payload);
			addToast('Theme saved', 'success');
			themeSuccess = true;
			setTimeout(() => (themeSuccess = false), 1500);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to save theme', 'error');
		} finally {
			savingTheme = false;
		}
	}
	async function load() {
		try {
			// Lazy-load the widget bundle alongside the theme fetch — the bundle
			// load is tiny and network-bound, the theme fetch tiny and API-bound.
			const [themeResult] = await Promise.all([getTheme(slug), ensureWidgetBundle()]);
			theme = themeResult;
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to load theme', 'error');
		}
	}

	onMount(() => {
		load();
	});
</script>

<svelte:window onclick={handleWindowClick} />
<svelte:head>
	<link rel="stylesheet" href={googleFontUrl} />
</svelte:head>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
	<!-- Theme Form -->
	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSaveTheme();
		}}
		class="space-y-3"
	>
		<fieldset class="space-y-2">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<label class="block">
					<span class="text-sm text-text-muted">Label</span>
					<input
						bind:value={theme.label}
						placeholder="Your assistant tagline"
						class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
					/>
				</label>
				<label class="block">
					<span class="text-sm text-text-muted">Placeholder</span>
					<input
						bind:value={theme.placeholder}
						placeholder="Ask a question..."
						class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
					/>
				</label>
			</div>
			<label class="block">
				<span class="text-sm text-text-muted">Greeting</span>
				<textarea
					bind:value={theme.greeting}
					rows="1"
					placeholder="Hi! How can I help?"
					class="mt-1 w-full resize-none rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
				></textarea>
			</label>
			<div class="flex items-end gap-3">
				<label class="block flex-1">
					<span class="text-sm text-text-muted">Launcher Hint</span>
					<input
						bind:value={theme.launcher_hint}
						placeholder="Text above chat button"
						class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
					/>
				</label>
				<label class="flex shrink-0 items-center gap-2 pb-1.5">
					<input
						type="checkbox"
						bind:checked={theme.show_sample_messages_in_greeting}
						class="accent-accent"
					/>
					<span class="text-xs text-text-muted">Sample Qs in greeting</span>
				</label>
			</div>
		</fieldset>

		<fieldset class="space-y-2">
			<legend class="mb-1 text-sm font-medium text-text-muted">Colors</legend>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each [['Primary', 'primary_color', '#6366f1'], ['Background', 'bg_color', '#0f172a'], ['Text', 'text_color', '#e2e8f0'], ['User Bubble', 'user_bubble_color', '#4f46e5'], ['Bot Bubble', 'bot_bubble_color', '#1e293b']] as [label, key, fallback]}
					<label class="block">
						<span class="text-xs text-text-muted">{label}</span>
						<span class="mt-0.5 flex items-center gap-2">
							<input
								type="color"
								value={themeColor(key, fallback)}
								oninput={(e) => setThemeColor(key, e)}
								class="h-8 w-8 shrink-0 cursor-pointer rounded border border-border"
							/>
							<input
								type="text"
								value={themeColor(key, '')}
								oninput={(e) => setThemeColor(key, e)}
								placeholder={fallback}
								class="min-w-0 flex-1 rounded-lg border border-border bg-surface-alt px-2 py-1 font-mono text-xs text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
							/>
						</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset class="space-y-2">
			<legend class="mb-1 text-sm font-medium text-text-muted">Style</legend>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div class="block">
					<span class="text-sm text-text-muted">Font Family</span>
					<div class="font-dropdown-wrapper relative mt-1">
						<input
							bind:value={theme.font_family}
							placeholder="Inter"
							onfocus={() => {
								fontDropdownOpen = true;
								fontFilterActive = false;
							}}
							oninput={() => {
								fontDropdownOpen = true;
								fontFilterActive = true;
							}}
							class="w-full rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
							style="font-family: {theme.font_family || 'inherit'};"
						/>
						{#if fontDropdownOpen}
							<div
								class="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-surface-alt shadow-lg"
							>
								{#each ALLOWED_FONT_FAMILIES.filter((f) => !fontFilterActive || !theme.font_family || f
											.toLowerCase()
											.includes((theme.font_family ?? '').toLowerCase())) as font}
									<button
										type="button"
										class="w-full px-3 py-1.5 text-left text-sm text-text transition-colors hover:bg-accent/20"
										style="font-family: '{font}', sans-serif;"
										onclick={() => {
											theme.font_family = font;
											fontDropdownOpen = false;
											fontFilterActive = false;
										}}
									>
										{font}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>
				<label class="block">
					<span class="text-sm text-text-muted">Border Radius (px)</span>
					<input
						type="number"
						bind:value={theme.border_radius}
						placeholder="12"
						class="mt-1 w-full rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
					/>
				</label>
			</div>
		</fieldset>

		<div class="sticky bottom-0 z-10 bg-surface pt-2 pb-1">
			<button
				type="submit"
				disabled={savingTheme}
				class="rounded-lg px-6 py-2 text-sm font-medium text-white transition-colors duration-200 disabled:opacity-40 {themeSuccess
					? 'bg-green-600'
					: 'bg-accent hover:bg-accent/90'}"
			>
				{savingTheme ? 'Saving...' : themeSuccess ? '\u2713 Saved' : 'Save Theme'}
			</button>
		</div>
	</form>

	<!-- Preview + Embed -->
	<div class="space-y-2">
		<!-- Embed snippet — single line with copy -->
		<div class="flex items-center gap-3">
			<span class="shrink-0 text-sm font-medium text-text-muted">Embed Code</span>
			<code
				class="min-w-0 flex-1 truncate rounded-lg border border-border bg-surface-alt px-3 py-1.5 font-mono text-xs text-text"
				>{getEmbedSnippet()}</code
			>
			<button onclick={copyEmbedInTab} class="shrink-0 text-xs text-accent hover:underline">
				{embedCopiedInTab ? 'Copied!' : 'Copy'}
			</button>
		</div>

		<!-- Live chat preview — uses the real widget panel height -->
		<div class="overflow-hidden rounded-lg" style="height: 520px;">
			{#if widgetBundleError}
				<div class="flex h-full items-center justify-center text-sm text-text-muted">
					{widgetBundleError}
				</div>
			{:else if widgetBundleLoaded}
				<ragr-chat bind:this={widgetPreviewEl} slug={model.slug} inline open></ragr-chat>
			{:else}
				<div class="flex h-full items-center justify-center text-sm text-text-muted">
					Loading preview…
				</div>
			{/if}
		</div>

		<!-- Launcher preview — stacked like the real widget: hint above, FAB below -->
		<div class="flex flex-col items-end gap-1.5">
			{#if launcherHintText}
				<div
					class="rounded-xl border px-3 py-2 text-xs shadow-md"
					style="background: {theme.bg_color ?? '#0f172a'}; color: {theme.text_color ??
						'#e2e8f0'}; border-color: color-mix(in srgb, {theme.text_color ??
						'#e2e8f0'} 20%, transparent); font-family: {theme.font_family ?? 'inherit'};"
				>
					{launcherHintText}
				</div>
			{/if}
			<button
				aria-label="Launcher preview"
				class="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-lg"
				style="background: {theme.primary_color ?? '#6366f1'};"
			>
				<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path
						d="M8 10h8M8 14h5M12 3C7.03 3 3 6.58 3 11c0 2.02.84 3.87 2.23 5.29L5 21l4.08-1.91c.92.25 1.9.38 2.92.38 4.97 0 9-3.58 9-8s-4.03-8.47-9-8.47z"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
	</div>
</div>
