/// <reference types="svelte-clerk/env" />
// Brings in App.Platform (env, ctx, cf) for the Cloudflare adapter, so
// server code can read request geo and hand work to ctx.waitUntil.
/// <reference types="@sveltejs/adapter-cloudflare" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
