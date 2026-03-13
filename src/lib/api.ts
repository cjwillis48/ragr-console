import { env } from '$env/dynamic/public';
import type { ModelInfo, WidgetTheme, Message } from './types';
import type { SSEEvent } from './types';
import { parseSSE } from './sse';

const baseUrl = () => env.PUBLIC_RAGR_API_URL;

export async function fetchModelInfo(slug: string): Promise<ModelInfo> {
	const res = await fetch(`${baseUrl()}/models/${slug}/info`);
	if (!res.ok) {
		if (res.status === 404) throw new Error('not_found');
		throw new Error(`Failed to load model info (${res.status})`);
	}
	return res.json();
}

export async function fetchTheme(slug: string): Promise<WidgetTheme> {
	const res = await fetch(`${baseUrl()}/models/${slug}/theme`);
	if (!res.ok) throw new Error(`Failed to load theme (${res.status})`);
	return res.json();
}

interface StreamCallbacks {
	onDelta: (text: string) => void;
	onDone: (answer: string, status: string) => void;
	onError: (msg: string) => void;
}

export async function streamChat(
	slug: string,
	question: string,
	sessionId: string,
	callbacks: StreamCallbacks,
	signal?: AbortSignal
): Promise<void> {
	let res: Response;
	try {
		res = await fetch(`${baseUrl()}/models/${slug}/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ question, stream: true, session_id: sessionId }),
			signal
		});
	} catch (err: unknown) {
		if (signal?.aborted) return;
		callbacks.onError('Network error. Please check your connection and try again.');
		return;
	}

	if (!res.ok) {
		callbacks.onError(`Request failed (${res.status}). Please try again.`);
		return;
	}

	try {
		for await (const event of parseSSE(res)) {
			if (signal?.aborted) return;
			switch (event.type) {
				case 'delta':
					callbacks.onDelta(event.text);
					break;
				case 'done':
					callbacks.onDone(event.answer, event.status);
					return;
				case 'error':
					callbacks.onError(event.error);
					return;
			}
		}
	} catch (err: unknown) {
		if (signal?.aborted) return;
		callbacks.onError('Connection lost. Please try again.');
	}
}
