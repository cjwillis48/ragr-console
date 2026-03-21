export interface ModelInfo {
	name: string;
	slug: string;
	description: string;
	allowed_origins: string[];
	accepting_requests: boolean;
	sample_questions: string[];
}

export interface WidgetTheme {
	label?: string | null;
	greeting?: string | null;
	placeholder?: string | null;
	launcher_hint?: string | null;
	primary_color?: string | null;
	bg_color?: string | null;
	text_color?: string | null;
	user_bubble_color?: string | null;
	bot_bubble_color?: string | null;
	font_family?: string | null;
	border_radius?: number | null;
}

export interface Message {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	status?: string;
	isStreaming?: boolean;
}

export type SSEEvent =
	| { type: 'delta'; text: string }
	| { type: 'done'; answer: string; status: string }
	| { type: 'error'; error: string };
