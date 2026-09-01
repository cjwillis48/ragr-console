<script lang="ts">
	import { SignUp } from 'svelte-clerk';
	import { dark } from '@clerk/themes';
</script>

<svelte:head>
	<title>Sign Up - RAGr</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- Same rationale as sign-in: default to /admin, but preserve deep links. -->
<div class="flex min-h-dvh items-center justify-center bg-surface">
	<SignUp appearance={{ baseTheme: dark }} fallbackRedirectUrl="/admin" />
</div>
