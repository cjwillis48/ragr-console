<script lang="ts">
	import '../app.css';
	import { ClerkProvider } from 'svelte-clerk';
	import { dark } from '@clerk/themes';

	let { children } = $props();
</script>

<ClerkProvider appearance={{ baseTheme: dark }}>
	{@render children()}
</ClerkProvider>
