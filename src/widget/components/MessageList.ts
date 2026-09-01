// MessageList — renders the conversation history.
//
// Key differences from the old Svelte implementation:
//   - NO off_topic / unanswered status badges. Those categories are now
//     maintainer-only (visible in analytics); end users just see the
//     natural-language answer. Error states are still surfaced inline.
//   - Markdown is rendered via renderMarkdown() from src/lib/chat-utils
//     and injected via dangerouslySetInnerHTML (Preact's __html escape hatch).
//     Content is sanitized by DOMPurify inside renderMarkdown.
//   - Suggestion pills are shown below a bot message when
//     getSuggestionsForMessage returns a non-empty array.
import { html } from 'htm/preact';
import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Message } from '../../lib/types';
import { getSuggestionsForMessage, renderMarkdown } from '../../lib/chat-utils';

export interface MessageListProps {
	messages: Message[];
	sampleMessages: string[];
	showSampleMessagesInGreeting: boolean;
	onSuggestion: (text: string) => void;
}

const STICK_THRESHOLD_PX = 96;
const SCROLL_DEBOUNCE_MS = 50;
const SCROLL_NOISE_PX = 4;

function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

function distanceFromBottom(el: HTMLElement): number {
	return el.scrollHeight - el.scrollTop - el.clientHeight;
}

export function MessageList(props: MessageListProps): ComponentChildren {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [userDetached, setUserDetached] = useState(false);

	// Set just before any programmatic scrollTop write; cleared on the next
	// animation frame. Scroll events fired while this is true must not be
	// treated as user-initiated, otherwise auto-stick triggers a false detach.
	const programmaticScrollRef = useRef(false);
	const lastScrollTopRef = useRef(0);
	const scrollDebounceRef = useRef<number | null>(null);
	const lastUserMessageIdRef = useRef<string | null>(null);

	const scrollToBottom = useCallback((smooth: boolean) => {
		const el = containerRef.current;
		if (!el) return;
		programmaticScrollRef.current = true;
		if (smooth && !prefersReducedMotion()) {
			el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
		} else {
			el.scrollTop = el.scrollHeight;
		}
		requestAnimationFrame(() => {
			programmaticScrollRef.current = false;
		});
	}, []);

	useEffect(() => {
		const messages = props.messages;
		const last = messages.length > 0 ? messages[messages.length - 1] : null;
		const lastUserId = lastUserMessageIdRef.current;

		if (last && last.role === 'user' && last.id !== lastUserId) {
			lastUserMessageIdRef.current = last.id;
			setUserDetached(false);
			scrollToBottom(false);
			return;
		}

		if (!userDetached) {
			scrollToBottom(false);
		}
	}, [props.messages, userDetached, scrollToBottom]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		lastScrollTopRef.current = el.scrollTop;

		const handleScroll = () => {
			if (programmaticScrollRef.current) return;

			const delta = Math.abs(el.scrollTop - lastScrollTopRef.current);
			if (delta < SCROLL_NOISE_PX) return;
			lastScrollTopRef.current = el.scrollTop;

			if (scrollDebounceRef.current !== null) {
				window.clearTimeout(scrollDebounceRef.current);
			}
			scrollDebounceRef.current = window.setTimeout(() => {
				scrollDebounceRef.current = null;
				const dist = distanceFromBottom(el);
				const nearBottom = dist <= STICK_THRESHOLD_PX;
				setUserDetached((prev) => {
					if (nearBottom && prev) return false;
					if (!nearBottom && !prev) return true;
					return prev;
				});
			}, SCROLL_DEBOUNCE_MS);
		};

		el.addEventListener('scroll', handleScroll, { passive: true });
		return () => {
			el.removeEventListener('scroll', handleScroll);
			if (scrollDebounceRef.current !== null) {
				window.clearTimeout(scrollDebounceRef.current);
				scrollDebounceRef.current = null;
			}
		};
	}, []);

	const handleJumpClick = useCallback(() => {
		scrollToBottom(true);
		setUserDetached(false);
	}, [scrollToBottom]);

	return html`
		<div class="ragr-messages-wrap">
			<div class="ragr-messages" ref=${containerRef}>
				${props.messages.map((msg, i) => {
					const suggestions = getSuggestionsForMessage(
						msg,
						i,
						props.messages,
						props.sampleMessages,
						props.showSampleMessagesInGreeting
					);
					if (msg.role === 'user') {
						return html`
							<div key=${msg.id} class="ragr-row ragr-row-user">
								<div class="ragr-bubble ragr-bubble-user">${msg.content}</div>
							</div>
						`;
					}
					const isError = msg.status === 'error';
					return html`
						<div key=${msg.id} class="ragr-row ragr-row-bot">
							<div class="ragr-bubble-group">
								<div class=${`ragr-bubble ragr-bubble-bot${isError ? ' ragr-bubble-error' : ''}`}>
									${
										msg.content
											? html`<div
													class="ragr-markdown"
													dangerouslySetInnerHTML=${{ __html: renderMarkdown(msg.content) }}
												/>`
											: msg.isStreaming
												? // Dot spans are deliberately on a single line — htm preserves
													// whitespace-only text nodes between element children, and those
													// become anonymous flex items in an inline-flex container, which
													// visibly offsets the dots.
													html`<span
														class="ragr-typing"
														role="status"
														aria-label="Assistant is typing"
														><span class="ragr-typing-dot"></span
														><span class="ragr-typing-dot"></span
														><span class="ragr-typing-dot"></span
													></span>`
												: null
									}
								</div>
								${
									suggestions.length > 0
										? html`
												<div class="ragr-suggestions">
													${suggestions.map(
														(text) => html`
														<button
															type="button"
															class="ragr-suggestion"
															onClick=${() => props.onSuggestion(text)}
														>
															${text}
														</button>
													`
													)}
												</div>
											`
										: null
								}
							</div>
						</div>
					`;
				})}
			</div>
			${
				userDetached
					? html`
							<button
								type="button"
								class="ragr-jump-to-bottom"
								aria-label="Scroll to latest messages"
								title="Jump to latest"
								onClick=${handleJumpClick}
							>
								<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
									<path
										d="M3 6l5 5 5-5"
										stroke="currentColor"
										stroke-width="1.8"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</button>
						`
					: null
			}
		</div>
	`;
}
