// Theme application for <ragr-chat>.
//
// The widget exposes 11 theme tokens (see WidgetTheme). We translate those
// into CSS custom properties on the host element so the shadow-root
// stylesheet can consume them via `var(--ragr-*)`. Applied on the HOST
// element (not the shadow root) because:
//   1. Updating :host rules from JS requires mutating a CSSStyleSheet, which
//      is awkward and browser-inconsistent for style updates.
//   2. CSS custom properties set on the host element inherit into the
//      shadow root for free.
//   3. The admin theme preview pane can drive live updates by just calling
//      applyThemeVars() without any Preact re-render.
import type { WidgetTheme } from '../lib/types';

export interface ResolvedTheme {
	primary: string;
	bg: string;
	text: string;
	userBubble: string;
	botBubble: string;
	radius: number;
	font: string;
}

const DEFAULTS: ResolvedTheme = {
	primary: '#6366f1',
	bg: '#0f172a',
	text: '#e2e8f0',
	userBubble: '#4f46e5',
	botBubble: '#1e293b',
	radius: 12,
	font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
};

function fontStack(family: string | null | undefined): string {
	if (!family) return DEFAULTS.font;
	// Wrap multi-word families in quotes. Fall back to the system stack.
	const quoted = /\s/.test(family) ? `"${family}"` : family;
	return `${quoted}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
}

export function resolveTheme(theme: WidgetTheme): ResolvedTheme {
	return {
		primary: theme.primary_color || DEFAULTS.primary,
		bg: theme.bg_color || DEFAULTS.bg,
		text: theme.text_color || DEFAULTS.text,
		userBubble: theme.user_bubble_color || DEFAULTS.userBubble,
		botBubble: theme.bot_bubble_color || DEFAULTS.botBubble,
		radius: typeof theme.border_radius === 'number' ? theme.border_radius : DEFAULTS.radius,
		font: fontStack(theme.font_family)
	};
}

export function applyThemeVars(host: HTMLElement, theme: WidgetTheme): void {
	const resolved = resolveTheme(theme);
	const s = host.style;
	s.setProperty('--ragr-primary', resolved.primary);
	s.setProperty('--ragr-bg', resolved.bg);
	s.setProperty('--ragr-text', resolved.text);
	s.setProperty('--ragr-user-bubble', resolved.userBubble);
	s.setProperty('--ragr-bot-bubble', resolved.botBubble);
	s.setProperty('--ragr-radius', `${resolved.radius}px`);
	s.setProperty('--ragr-font', resolved.font);
	// Derived border token — 20% of the text color blended with transparent.
	// Used by panel borders, bubble borders, and input outlines.
	s.setProperty(
		'--ragr-border',
		`color-mix(in srgb, ${resolved.text} 20%, transparent)`
	);
	// Soft fill for suggestion pills and input backgrounds.
	s.setProperty(
		'--ragr-soft-fill',
		`color-mix(in srgb, ${resolved.text} 10%, ${resolved.bg})`
	);
}
