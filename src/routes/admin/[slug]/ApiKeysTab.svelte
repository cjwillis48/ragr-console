<script lang="ts">
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';
	import { createApiKey, listApiKeys, revokeApiKey } from '$lib/admin-api';
	import type { ApiKeyCreateResponse, ApiKeyRead, RagModel } from '$lib/admin-types';
	import { addToast } from '$lib/toast.svelte';

	let { model }: { model: RagModel } = $props();

	const slug = $derived(page.params.slug!);

	let apiKeys = $state<ApiKeyRead[]>([]);
	let newKeyLabel = $state('');
	let creatingKey = $state(false);
	let newlyCreatedKey = $state<ApiKeyCreateResponse | null>(null);
	let keyCopied = $state(false);
	let pendingRevokeKeyId = $state<string | null>(null);
	let revokeTimer: ReturnType<typeof setTimeout> | null = null;

	async function load() {
		try {
			apiKeys = await listApiKeys(slug);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to load API keys', 'error');
		}
	}

	onMount(() => {
		load();
		return () => clearRevokeTimer();
	});

	async function handleCreateKey() {
		if (!newKeyLabel.trim()) return;
		creatingKey = true;
		try {
			newlyCreatedKey = await createApiKey(slug, newKeyLabel.trim());
			newKeyLabel = '';
			apiKeys = await listApiKeys(slug);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to create key', 'error');
		} finally {
			creatingKey = false;
		}
	}

	function clearRevokeTimer() {
		if (revokeTimer) {
			clearTimeout(revokeTimer);
			revokeTimer = null;
		}
	}

	async function handleRevokeKey(keyId: number) {
		const id = String(keyId);
		if (pendingRevokeKeyId !== id) {
			pendingRevokeKeyId = id;
			clearRevokeTimer();
			revokeTimer = setTimeout(() => {
				pendingRevokeKeyId = null;
				revokeTimer = null;
			}, 3000);
			return;
		}
		clearRevokeTimer();
		pendingRevokeKeyId = null;
		try {
			await revokeApiKey(slug, keyId);
			apiKeys = await listApiKeys(slug);
		} catch (e: unknown) {
			addToast(e instanceof Error ? e.message : 'Failed to revoke key', 'error');
		}
	}

	async function copyRawKey() {
		if (!newlyCreatedKey) return;
		await navigator.clipboard.writeText(newlyCreatedKey.raw_key);
		keyCopied = true;
		setTimeout(() => (keyCopied = false), 2000);
	}
</script>

<div class="max-w-2xl space-y-6">
	<div class="flex items-center gap-3">
		<h3 class="text-sm font-medium text-text-muted">RAGr API Keys</h3>
		<a
			href="{env.PUBLIC_RAGR_API_URL}/docs"
			target="_blank"
			rel="noopener noreferrer"
			class="text-xs text-accent hover:underline"
		>
			API Docs &nearr;
		</a>
	</div>

	<p class="text-xs text-text-muted">
		Use these keys to call this model's API from your own apps. Pass them in the <code
			>Authorization: Bearer &lt;key&gt;</code
		> header.
	</p>

	<!-- Scope info -->
	<div class="space-y-2 rounded-lg border border-border bg-surface-alt p-4 text-xs text-text-muted">
		<p class="font-medium text-text">
			Per-model keys are scoped to <span class="font-mono text-accent">/models/{model.slug}</span> endpoints
			only.
		</p>
		<p>
			A key for this model cannot access other models. Using it on a different slug returns <span
				class="font-mono">401</span
			>.
		</p>
	</div>

	<!-- Create key -->
	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleCreateKey();
		}}
		class="space-y-3 rounded-lg border border-border bg-surface-alt p-4"
	>
		<h3 class="text-sm font-medium">Generate New Key</h3>
		<div class="flex gap-2">
			<input
				bind:value={newKeyLabel}
				placeholder="Key label (e.g. 'production', 'staging')"
				class="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
			/>
			<button
				type="submit"
				disabled={creatingKey || !newKeyLabel.trim()}
				class="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-40"
			>
				{creatingKey ? 'Creating...' : 'Generate'}
			</button>
		</div>
	</form>

	<!-- Newly created key banner -->
	{#if newlyCreatedKey}
		<div class="space-y-2 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium text-green-400">Key created: {newlyCreatedKey.label}</span>
				<button
					onclick={() => (newlyCreatedKey = null)}
					disabled={!keyCopied}
					title={!keyCopied ? 'Copy the key first.' : ''}
					class="text-xs text-text-muted hover:text-text {!keyCopied
						? 'cursor-not-allowed opacity-40'
						: ''}">&times;</button
				>
			</div>
			<p class="text-xs text-yellow-400">This key will only be shown once. Save it now.</p>
			<div class="flex items-center gap-2">
				<code
					class="flex-1 rounded-lg bg-surface px-3 py-2 font-mono text-sm break-all text-text select-all"
					>{newlyCreatedKey.raw_key}</code
				>
				<button
					onclick={copyRawKey}
					class="shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-muted hover:border-accent hover:text-text"
				>
					{keyCopied ? 'Copied!' : 'Copy'}
				</button>
			</div>
			<p class="text-xs text-text-muted">Try it:</p>
			<pre
				class="rounded-lg bg-surface px-3 py-2 font-mono text-xs break-all whitespace-pre-wrap select-all"><code
					>curl -H "Authorization: Bearer {newlyCreatedKey.raw_key}" \
  -H "Content-Type: application/json" \
  -d '&lbrace;"message": "Hello"&rbrace;' \
  {env.PUBLIC_RAGR_API_URL}/models/{model.slug}/chat</code
				></pre>
		</div>
	{/if}

	<!-- Key list -->
	{#if apiKeys.length > 0}
		<div class="space-y-2">
			{#each apiKeys as key}
				<div
					class="flex items-center justify-between rounded-lg border border-border bg-surface-alt px-4 py-3"
				>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium">{key.label}</span>
							{#if !key.is_active}
								<span class="rounded bg-error/20 px-2 py-0.5 text-xs text-error">revoked</span>
							{/if}
						</div>
						<div class="mt-1 font-mono text-xs text-text-muted">
							{key.key_prefix}...
							<span class="ml-2 font-sans">
								Created {new Date(key.created_at).toLocaleDateString()}
								{#if key.last_used_at}
									&middot; Last used {new Date(key.last_used_at).toLocaleDateString()}
								{:else}
									&middot; Never used
								{/if}
							</span>
						</div>
					</div>
					{#if key.is_active}
						<button
							onclick={() => handleRevokeKey(key.id)}
							class="ml-4 shrink-0 text-sm {pendingRevokeKeyId === String(key.id)
								? 'text-error'
								: 'text-text-muted hover:text-error'}"
							>{pendingRevokeKeyId === String(key.id) ? 'Click to confirm' : 'Revoke'}</button
						>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-sm text-text-muted">No API keys yet.</div>
	{/if}
</div>
