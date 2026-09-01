<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts, removeToast } from '$lib/toast.svelte';
</script>

{#if toasts.length > 0}
	<div class="fixed right-6 bottom-6 z-50 flex flex-col gap-2">
		{#each toasts as toast (toast.id)}
			<div
				transition:fly={{ y: 20, duration: 200 }}
				class="flex max-w-sm min-w-72 items-center gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg {toast.type ===
				'success'
					? 'bg-green-600'
					: 'bg-red-600'}"
			>
				<span class="flex-1">{toast.message}</span>
				<button
					onclick={() => removeToast(toast.id)}
					class="text-lg leading-none text-white/70 hover:text-white">&times;</button
				>
			</div>
		{/each}
	</div>
{/if}
