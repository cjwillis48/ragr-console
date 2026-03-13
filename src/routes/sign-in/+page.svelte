<script lang="ts">
	import { SignIn } from 'svelte-clerk';
	import { dark } from '@clerk/themes';
</script>

<svelte:head><title>Sign In - RAGr</title></svelte:head>

<div class="min-h-dvh bg-surface flex items-center justify-center">
	<SignIn appearance={{ baseTheme: dark }} />
</div>
