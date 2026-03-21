import { sanitizeHtml } from '$lib/sanitize';
import { marked } from 'marked';
import type { Message } from '$lib/types';

export function isNonAnswered(s: string | undefined): boolean {
	return typeof s === 'string' && s !== 'answered';
}

export function getStatusLabel(s: string | undefined): string {
	if (s === 'off_topic') return 'Off-topic';
	if (s === 'unanswered') return 'Unanswered';
	if (s === 'error') return 'Error';
	return s?.replace(/_/g, ' ') ?? 'Status';
}

export function getStatusDescription(s: string | undefined): string {
	if (s === 'off_topic') return "This question may be outside this assistant's knowledge.";
	if (s === 'unanswered') return "Couldn't confidently answer from current knowledge. Try rephrasing.";
	if (s === 'error') return 'Something went wrong. Please try again.';
	return '';
}

export function getStatusContainerClass(s: string | undefined): string {
	if (s === 'off_topic') return 'bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30';
	if (s === 'unanswered') return 'bg-sky-50 text-sky-900 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:border-sky-500/30';
	if (s === 'error') return 'bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-500/30';
	return 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100';
}

export function getStatusBadgeClass(s: string | undefined): string {
	if (s === 'off_topic') return 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/20 dark:text-amber-100';
	if (s === 'unanswered') return 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-400/40 dark:bg-sky-400/20 dark:text-sky-100';
	if (s === 'error') return 'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-400/40 dark:bg-rose-400/20 dark:text-rose-100';
	return 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-500/40 dark:bg-slate-500/20 dark:text-slate-100';
}

export function getStatusDescriptionClass(s: string | undefined): string {
	if (s === 'off_topic') return 'text-amber-800 dark:text-amber-200/90';
	if (s === 'unanswered') return 'text-sky-800 dark:text-sky-200/90';
	if (s === 'error') return 'text-rose-800 dark:text-rose-200/90';
	return 'text-slate-700 dark:text-slate-300';
}

export function renderMarkdown(text: string): string {
	const html = marked.parse(text, { gfm: true, breaks: true });
	return sanitizeHtml(typeof html === 'string' ? html : '');
}

export function getSuggestionsForMessage(
	msg: Message,
	index: number,
	messages: Message[],
	sampleQuestions: string[],
	showInGreeting: boolean
): string[] {
	if (sampleQuestions.length === 0) return [];
	if (showInGreeting && index === messages.length - 1 && msg.role === 'assistant' && msg.status === 'answered' && messages.every(m => m.role === 'assistant')) {
		return sampleQuestions;
	}
	if (msg.status === 'off_topic' && !msg.isStreaming) {
		const isFirstOffTopic = messages.findIndex(m => m.status === 'off_topic') === index;
		if (isFirstOffTopic) return sampleQuestions;
	}
	return [];
}
