import type { SSEEvent } from './types';

export async function* parseSSE(response: Response): AsyncGenerator<SSEEvent> {
	const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += value;
			const parts = buffer.split('\n\n');
			buffer = parts.pop()!;

			for (const part of parts) {
				const event = parseEvent(part);
				if (event) yield event;
			}
		}

		if (buffer.trim()) {
			const event = parseEvent(buffer);
			if (event) yield event;
		}
	} finally {
		reader.releaseLock();
	}
}

function parseEvent(raw: string): SSEEvent | null {
	let eventType = '';
	let data = '';

	for (const line of raw.split('\n')) {
		if (line.startsWith('event:')) {
			eventType = line.slice(6).trim();
		} else if (line.startsWith('data:')) {
			data = line.slice(5).trim();
		}
	}

	if (!data) return null;

	try {
		const parsed = JSON.parse(data);

		if (eventType === 'done') {
			return { type: 'done', response: parsed.response, status: parsed.status };
		}
		if (eventType === 'error') {
			return { type: 'error', error: parsed.error };
		}
		// Default event — delta is a plain JSON string
		if (typeof parsed === 'string') {
			return { type: 'delta', text: parsed };
		}
		// Also support {"t": "..."} format
		if (parsed && typeof parsed === 'object' && 't' in parsed) {
			return { type: 'delta', text: parsed.t };
		}

		return null;
	} catch {
		return null;
	}
}
