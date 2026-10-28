import type { HandleClientError } from '@sveltejs/kit';
import { report, reportError } from '$lib/log';

export const handleError: HandleClientError = ({ error, event, status, message }) => {
	reportError(error, {
		event: 'client_error',
		url: event.url?.toString(),
		route: event.route?.id,
		status,
		kit_message: message
	});

	return { message: 'An unexpected error occurred' };
};

// `handleError` only fires for errors thrown inside load and render. The admin
// console does nearly all of its work in event handlers and effects, where a
// throw escapes to the window instead — so cover both window-level channels or
// most real failures still go unrecorded.
if (typeof window !== 'undefined') {
	window.addEventListener('unhandledrejection', (e) => {
		reportError(e.reason, { event: 'unhandled_rejection', url: location.href });
	});

	window.addEventListener('error', (e) => {
		if (e.error) {
			reportError(e.error, { event: 'window_error', url: location.href });
		} else {
			// Resource load failures (script, image) surface with no `error`.
			report('warn', e.message || 'Resource error', {
				event: 'window_error',
				url: location.href,
				filename: e.filename
			});
		}
	});
}
