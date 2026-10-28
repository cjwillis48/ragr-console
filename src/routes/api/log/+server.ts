import { logClientEvent } from '$lib/axiom';
import type { RequestHandler } from './$types';

/**
 * Sink for browser-side error reports (see `src/lib/log.ts`).
 *
 * The Axiom token is server-only, so the browser cannot ingest directly. This
 * endpoint is the whole reason failures between the console and the RAGR API
 * are visible at all — they happen in the user's browser, not on any server
 * this app runs.
 */

const MAX_BODY_BYTES = 8 * 1024;
const MAX_FIELDS = 24;
const MAX_STRING = 2000;
const LEVELS = new Set(['error', 'warn', 'info']);

/** Flatten to scalars and truncate, so a caller cannot post arbitrary structures. */
function sanitise(input: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (Object.keys(out).length >= MAX_FIELDS) break;
		if (key === 'level' || value === undefined || value === null) continue;
		if (typeof value === 'string') out[key] = value.slice(0, MAX_STRING);
		else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
		else out[key] = JSON.stringify(value).slice(0, MAX_STRING);
	}
	return out;
}

export const POST: RequestHandler = async ({ request, locals, url, platform }) => {
	// Same-origin only. Browsers send `Origin` on every POST, so this is enough
	// to keep the dataset from being an open, billable write endpoint.
	if (request.headers.get('origin') !== url.origin) {
		return new Response(null, { status: 403 });
	}

	const raw = await request.text();
	if (raw.length > MAX_BODY_BYTES) {
		return new Response(null, { status: 413 });
	}

	let body: Record<string, unknown>;
	try {
		body = JSON.parse(raw);
	} catch {
		return new Response(null, { status: 400 });
	}
	if (typeof body !== 'object' || body === null) {
		return new Response(null, { status: 400 });
	}

	const level = typeof body.level === 'string' ? body.level : 'error';
	if (!LEVELS.has(level)) {
		return new Response(null, { status: 400 });
	}

	let userId: string | null = null;
	try {
		userId = locals.auth().userId;
	} catch {
		// Public pages have no Clerk session; not an error.
	}

	await logClientEvent(level as 'error' | 'warn' | 'info', {
		source: 'client',
		...sanitise(body),
		user_id: userId,
		user_agent: request.headers.get('user-agent')?.slice(0, 512),
		country: platform?.cf?.country
	});

	return new Response(null, { status: 204 });
};
