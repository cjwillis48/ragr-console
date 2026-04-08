import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { withClerkHandler } from 'svelte-clerk/server';
import { env } from '$env/dynamic/public';
import { logError } from '$lib/axiom';

function originBlockedResponse(refererOrigin: string): Response {
	const safeOrigin = JSON.stringify(refererOrigin);
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>html,body{margin:0;padding:0;background:transparent;}</style>
</head>
<body>
<script>console.warn('[ragr] Chat widget blocked: '+${safeOrigin}+' is not in the allowed origins for this model.');</script>
</body>
</html>`;

	return new Response(html, {
		status: 403,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Content-Security-Policy': "frame-ancestors *"
		}
	});
}

const cspHandler: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Add CSP frame-ancestors for embed pages
	if (path.match(/^\/chat\/[^/]+\/embed$/)) {
		const slug = path.split('/')[2];
		let frameAncestors = "'none'";
		let allowedOrigins: string[] = [];

		try {
			const res = await fetch(`${env.PUBLIC_RAGR_API_URL}/models/${slug}/info`);
			if (res.ok) {
				const info = await res.json();
				allowedOrigins = info.allowed_origins ?? [];
				if (allowedOrigins.length > 0) {
					frameAncestors = `'self' ${allowedOrigins.join(' ')}`;
				} else {
					frameAncestors = "'self'";
				}
			}
		} catch {
			frameAncestors = "'self'";
		}

		// Check if the request is from a disallowed origin and return a friendly error
		const referer = event.request.headers.get('referer');
		if (referer) {
			try {
				const refererOrigin = new URL(referer).origin;
				const selfOrigin = event.url.origin;
				const isAllowed =
					refererOrigin === selfOrigin ||
					allowedOrigins.some((o) => refererOrigin === o || refererOrigin === o.replace(/\/$/, ''));
				if (!isAllowed) {
					return originBlockedResponse(refererOrigin);
				}
			} catch {
				// Invalid referer URL, continue normally
			}
		}

		const response = await resolve(event);
		response.headers.set('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
		return response;
	}

	return resolve(event);
};

export const handle = sequence(withClerkHandler(), cspHandler);

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	logError(error, {
		url: event.url.toString(),
		method: event.request.method,
		status,
		message,
		route: event.route.id
	});

	return { message: 'An unexpected error occurred' };
};
