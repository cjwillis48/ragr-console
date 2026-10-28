import { browser } from '$app/environment';

/**
 * Browser-side error reporting.
 *
 * This is NOT a third API layer — it posts to this app's own `/api/log`
 * endpoint, never to the RAGR API. The Axiom token is server-only, so the
 * browser cannot ingest directly.
 */

const ENDPOINT = '/api/log';

/** Cap the damage from a component that fails on a timer or in a render loop. */
const MAX_EVENTS = 20;
const WINDOW_MS = 60_000;

let recent: number[] = [];

function allowed(): boolean {
	const now = Date.now();
	recent = recent.filter((t) => now - t < WINDOW_MS);
	if (recent.length >= MAX_EVENTS) return false;
	recent.push(now);
	return true;
}

export type ClientLevel = 'error' | 'warn' | 'info';

export function report(level: ClientLevel, message: string, context?: Record<string, unknown>) {
	if (!browser || !allowed()) return;

	try {
		void fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				level,
				message,
				page: location.pathname,
				...context
			}),
			// Survives the navigation or tab close that often follows the error.
			keepalive: true
		}).catch(() => {});
	} catch {
		// A logger that throws is worse than no logger.
	}
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
	const base =
		error instanceof Error
			? { message: error.message, stack: error.stack?.slice(0, 4000), name: error.name }
			: { message: String(error) };
	report('error', base.message, { ...context, stack: base.stack, name: base.name });
}
