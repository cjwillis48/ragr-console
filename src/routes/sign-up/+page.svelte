<script lang="ts">
	import { SignUp } from 'svelte-clerk';
	import { dark } from '@clerk/themes';
</script>

<svelte:head><title>Sign Up - RAGr</title></svelte:head>

<!-- Same rationale as sign-in: default to /admin, but preserve deep links. -->
<div class="min-h-dvh bg-surface flex items-center justify-center">
	<SignUp appearance={{ baseTheme: dark }} fallbackRedirectUrl="/admin" />
</div>
