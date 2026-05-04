import { marked } from 'marked';
import { sanitizeHtml } from './sanitize';
import type { Message } from './types';

export function renderMarkdown(text: string): string {
	const html = marked.parse(text, { gfm: true, breaks: true });
	return sanitizeHtml(typeof html === 'string' ? html : '');
}

// Decide whether a bot message should display the sample-question pills
// underneath it. Two cases trigger the pills:
//   1. The greeting — the very first assistant message, if the theme opts in
//      via `show_sample_messages_in_greeting`. Gives new visitors an
//      obvious starting point.
//   2. The first off-topic response — when the bot declines a question, we
//      surface the sample questions again so the user can redirect.
export function getSuggestionsForMessage(
	msg: Message,
	index: number,
	messages: Message[],
	sampleMessages: string[],
	showInGreeting: boolean
): string[] {
	if (sampleMessages.length === 0) return [];
	if (
		showInGreeting &&
		index === messages.length - 1 &&
		msg.role === 'assistant' &&
		msg.status === 'answered' &&
		messages.every((m) => m.role === 'assistant')
	) {
		return sampleMessages;
	}
	if (msg.status === 'off_topic' && !msg.isStreaming) {
		const isFirstOffTopic = messages.findIndex((m) => m.status === 'off_topic') === index;
		if (isFirstOffTopic) return sampleMessages;
	}
	return [];
}
