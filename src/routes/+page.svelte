<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/admin');
	});
</script>

<div class="flex items-center justify-center h-screen text-text-muted">
	Redirecting...
</div>
