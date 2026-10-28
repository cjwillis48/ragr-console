import { Axiom } from '@axiomhq/js';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

let _client: Axiom | null = null;

function getClient(): Axiom | null {
	if (!env.AXIOM_TOKEN || !env.AXIOM_DATASET) return null;
	if (!_client) {
		_client = new Axiom({ token: env.AXIOM_TOKEN });
	}
	return _client;
}

/**
 * Ship one event and resolve once it has actually left the isolate.
 *
 * Callers MUST await this. On Cloudflare the isolate is torn down as soon as
 * the response is returned, so an un-awaited flush is simply cancelled and the
 * event is lost — that, plus the absence of any client-side reporting, is why
 * this dataset used to sit empty.
 */
async function emit(level: LogLevel, data: Record<string, unknown>): Promise<void> {
	const threshold = LOG_LEVELS[env.LOG_LEVEL?.toLowerCase() as LogLevel] ?? LOG_LEVELS.info;
	if (LOG_LEVELS[level] < threshold) return;

	const payload = {
		_time: new Date().toISOString(),
		level,
		service: 'ragr-console',
		...data
	};

	const client = getClient();
	if (!client) {
		// Unconfigured is a supported state (see .env.example), but staying
		// silent about it locally is what makes a broken setup look like a
		// quiet one.
		if (dev) console[level === 'debug' ? 'log' : level]('[axiom:unconfigured]', payload);
		return;
	}

	client.ingest(env.AXIOM_DATASET!, [payload]);
	try {
		await client.flush();
	} catch (err) {
		// Logging must never break a request, but a rejected ingest (bad token,
		// missing dataset, rate limit) is indistinguishable from "nothing
		// happened" if it is swallowed. Surface it in `wrangler tail`.
		console.error('[axiom] ingest failed', err);
	}
}

export function logError(error: unknown, context?: Record<string, unknown>): Promise<void> {
	const errorObj =
		error instanceof Error
			? { message: error.message, stack: error.stack, name: error.name }
			: { message: String(error) };
	return emit('error', { ...errorObj, ...context });
}

export function logWarn(message: string, context?: Record<string, unknown>): Promise<void> {
	return emit('warn', { message, ...context });
}

export function logInfo(message: string, context?: Record<string, unknown>): Promise<void> {
	return emit('info', { message, ...context });
}

export function logDebug(message: string, context?: Record<string, unknown>): Promise<void> {
	return emit('debug', { message, ...context });
}

/**
 * Ship an already-sanitised event forwarded from the browser by
 * `src/routes/api/log/+server.ts`. Level is validated by that endpoint.
 */
export function logClientEvent(
	level: 'error' | 'warn' | 'info',
	fields: Record<string, unknown>
): Promise<void> {
	return emit(level, fields);
}
