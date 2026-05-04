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
import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Message } from '../../lib/types';
import { getSuggestionsForMessage, renderMarkdown } from '../../lib/chat-utils';

export interface MessageListProps {
	messages: Message[];
	sampleMessages: string[];
	showSampleMessagesInGreeting: boolean;
	onSuggestion: (text: string) => void;
}

export function MessageList(props: MessageListProps): ComponentChildren {
	const containerRef = useRef<HTMLDivElement | null>(null);

	// Auto-scroll to bottom on every message change — matches the old behavior.
	// useEffect runs after paint, so scrollHeight reflects the new content.
	useEffect(() => {
		const el = containerRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [props.messages]);

	return html`
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
							<div
								class=${`ragr-bubble ragr-bubble-bot${isError ? ' ragr-bubble-error' : ''}`}
							>
								${msg.content
									? html`<div
											class="ragr-markdown"
											dangerouslySetInnerHTML=${{ __html: renderMarkdown(msg.content) }}
										/>`
									: msg.isStreaming
										? // Dot spans are deliberately on a single line — htm preserves
											// whitespace-only text nodes between element children, and those
											// become anonymous flex items in an inline-flex container, which
											// visibly offsets the dots.
											html`<span class="ragr-typing" role="status" aria-label="Assistant is typing"><span class="ragr-typing-dot"></span><span class="ragr-typing-dot"></span><span class="ragr-typing-dot"></span></span>`
										: null}
							</div>
							${suggestions.length > 0
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
								: null}
						</div>
					</div>
				`;
			})}
		</div>
	`;
}
