import type { Handle, HandleServerError } from '@sveltejs/kit';
import { withClerkHandler } from 'svelte-clerk/server';
import { logError } from '$lib/axiom';

// Note: the old cspHandler block that enforced `frame-ancestors` for the
// /chat/[slug]/embed iframe route has been removed along with that route.
// Origin enforcement now lives on the backend API via CORS headers on
// /models/{slug}/* endpoints.

export const handle: Handle = withClerkHandler();

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
