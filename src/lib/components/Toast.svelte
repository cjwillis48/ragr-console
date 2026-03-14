<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts, removeToast } from '$lib/toast.svelte';
</script>

{#if toasts.length > 0}
	<div class="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
		{#each toasts as toast (toast.id)}
			<div
				transition:fly={{ y: 20, duration: 200 }}
				class="flex items-center gap-3 min-w-72 max-w-sm rounded-lg px-4 py-3 shadow-lg text-sm text-white {toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}"
			>
				<span class="flex-1">{toast.message}</span>
				<button onclick={() => removeToast(toast.id)} class="text-white/70 hover:text-white text-lg leading-none">&times;</button>
			</div>
		{/each}
	</div>
{/if}
