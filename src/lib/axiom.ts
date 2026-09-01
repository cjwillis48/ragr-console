import { Axiom } from '@axiomhq/js';
import { env } from '$env/dynamic/private';

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

function emit(level: LogLevel, data: Record<string, unknown>) {
	const threshold = LOG_LEVELS[env.LOG_LEVEL?.toLowerCase() as LogLevel] ?? LOG_LEVELS.info;
	if (LOG_LEVELS[level] < threshold) return;

	const client = getClient();
	if (!client) return;

	client.ingest(env.AXIOM_DATASET!, [{ _time: new Date().toISOString(), level, ...data }]);
	client.flush().catch(() => {});
}

export function logError(error: unknown, context?: Record<string, unknown>) {
	const errorObj =
		error instanceof Error
			? { message: error.message, stack: error.stack, name: error.name }
			: { message: String(error) };
	emit('error', { ...errorObj, ...context });
}

export function logWarn(message: string, context?: Record<string, unknown>) {
	emit('warn', { message, ...context });
}

export function logInfo(message: string, context?: Record<string, unknown>) {
	emit('info', { message, ...context });
}

export function logDebug(message: string, context?: Record<string, unknown>) {
	emit('debug', { message, ...context });
}
