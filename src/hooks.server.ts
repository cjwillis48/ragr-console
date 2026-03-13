import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';
import { env } from '$env/dynamic/public';

const cspHandler: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Add CSP frame-ancestors for embed pages
	if (path.match(/^\/chat\/[^/]+\/embed$/)) {
		const slug = path.split('/')[2];
		let frameAncestors = "'none'";

		try {
			const res = await fetch(`${env.PUBLIC_RAGR_API_URL}/models/${slug}/info`);
			if (res.ok) {
				const info = await res.json();
				const origins: string[] = info.allowed_origins ?? [];
				if (origins.length > 0) {
					frameAncestors = `'self' ${origins.join(' ')}`;
				} else {
					frameAncestors = "'self'";
				}
			}
		} catch {
			frameAncestors = "'self'";
		}

		const response = await resolve(event);
		response.headers.set('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
		return response;
	}

	return resolve(event);
};

export const handle = sequence(withClerkHandler(), cspHandler);
