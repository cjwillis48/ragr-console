// useChat — the state machine for a live conversation inside the widget.
//
// Owns:
//   - the message list (seeded with the greeting if configured)
//   - the streaming in-flight state
//   - the session id (stable for the lifetime of the hook)
//   - an AbortController that is torn down when the hook unmounts so disconnecting
//     the <ragr-chat> element mid-stream doesn't leak a fetch
//
// Ports the streaming logic from src/routes/chat/[slug]/embed/+page.svelte
// lines 120–179 with no behavior changes — only the host framework differs.
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Message, ModelInfo, WidgetTheme } from '../lib/types';
import { streamChat } from './api';

export interface UseChatOptions {
	slug: string;
	apiBase?: string;
	modelInfo: ModelInfo | null;
	theme: WidgetTheme;
}

export interface UseChatResult {
	messages: Message[];
	isSending: boolean;
	error: string | null;
	send: (message: string) => Promise<void>;
	abort: () => void;
}

function randomId(): string {
	// Prefer crypto.randomUUID when available (universal in modern browsers,
	// including mobile Safari 15.4+, Chrome 92+, and Firefox 95+).
	//
	// Math.random is NOT an acceptable fallback — its predictable output
	// would let a host page guess other users' session IDs and hijack
	// conversations (security review finding M4). Fall back to
	// crypto.getRandomValues for a v4 UUID; hard-fail if neither exists.
	const c = typeof crypto !== 'undefined' ? crypto : undefined;
	if (c && typeof c.randomUUID === 'function') {
		return c.randomUUID();
	}
	if (c && typeof c.getRandomValues === 'function') {
		const bytes = new Uint8Array(16);
		c.getRandomValues(bytes);
		bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
		bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
		const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
	}
	throw new Error('[ragr-chat] no secure random source available');
}

function initialMessages(theme: WidgetTheme): Message[] {
	if (theme.greeting?.trim()) {
		return [
			{
				id: 'greeting',
				role: 'assistant',
				content: theme.greeting,
				status: 'answered'
			}
		];
	}
	return [];
}

export function useChat(opts: UseChatOptions): UseChatResult {
	const [messages, setMessages] = useState<Message[]>(() => initialMessages(opts.theme));
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const sessionIdRef = useRef<string>(randomId());
	const abortRef = useRef<AbortController | null>(null);

	// Reset session + seed greeting whenever the model or theme.greeting changes.
	// Split from the sending effect so sending doesn't re-seed the history.
	useEffect(() => {
		setMessages(initialMessages(opts.theme));
		sessionIdRef.current = randomId();
	}, [opts.slug, opts.theme.greeting]);

	// Abort any in-flight stream when unmounting or when the slug changes.
	useEffect(() => {
		return () => {
			abortRef.current?.abort();
			abortRef.current = null;
		};
	}, [opts.slug]);

	const abort = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		setIsSending(false);
	}, []);

	const send = useCallback(
		async (rawMessage: string) => {
			const message = rawMessage.trim();
			if (!message || isSending) return;
			if (!opts.modelInfo?.accepting_requests) return;

			setError(null);
			setIsSending(true);

			const assistantId = randomId();
			const userMessage: Message = { id: randomId(), role: 'user', content: message };
			const assistantMessage: Message = {
				id: assistantId,
				role: 'assistant',
				content: '',
				status: 'answered',
				isStreaming: true
			};

			setMessages((prev) => [...prev, userMessage, assistantMessage]);

			const controller = new AbortController();
			abortRef.current = controller;

			await streamChat(
				opts.slug,
				message,
				sessionIdRef.current,
				{
					onDelta(delta) {
						setMessages((prev) =>
							prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
						);
					},
					onDone(response, status) {
						setMessages((prev) =>
							prev.map((m) =>
								m.id === assistantId
									? { ...m, content: response, status, isStreaming: false }
									: m
							)
						);
						setIsSending(false);
						abortRef.current = null;
					},
					onError(msg) {
						setError(msg);
						setMessages((prev) =>
							prev.map((m) =>
								m.id === assistantId
									? {
											...m,
											content: m.content || msg,
											status: 'error',
											isStreaming: false
										}
									: m
							)
						);
						setIsSending(false);
						abortRef.current = null;
					}
				},
				controller.signal,
				opts.apiBase
			);

			// If the stream ended without emitting a done event, clean up.
			setIsSending((prev) => {
				if (prev) abortRef.current = null;
				return false;
			});
		},
		[opts.slug, opts.apiBase, opts.modelInfo, isSending]
	);

	return { messages, isSending, error, send, abort };
}
