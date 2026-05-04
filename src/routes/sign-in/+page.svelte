<script lang="ts">
	import { SignIn } from 'svelte-clerk';
	import { dark } from '@clerk/themes';
</script>

<svelte:head>
	<title>Sign In - RAGr</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!--
	fallbackRedirectUrl lands users on /admin when they sign in without a
	specific destination in mind (e.g. clicking "Sign In" from the marketing
	page). Clerk still honors an explicit ?redirect_url= query param first,
	so deep links into /admin/... survive the sign-in bounce correctly.
-->
<div class="min-h-dvh bg-surface flex items-center justify-center">
	<SignIn appearance={{ baseTheme: dark }} fallbackRedirectUrl="/admin" />
</div>
