// App — the Preact root rendered inside the <ragr-chat> shadow root.
//
// Owns:
//   - load lifecycle (fetchModelInfo + fetchTheme on mount)
//   - open/closed state (driven by initialOpen prop + inline mode)
//   - launcher hint visibility + auto-hide timer
//   - expand toggle (normal ↔ large) — CSS handles mobile fullscreen
//   - input value (controlled textarea)
//   - chat state (delegated to useChat)
//
// Does NOT own:
//   - theme CSS custom properties — element.ts calls applyThemeVars on the
//     host from onThemeChange so the host's inline style updates without
//     re-rendering the Preact tree for token tweaks
//   - stylesheet injection — element.ts injects STYLES into the shadow root
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { html } from 'htm/preact';
import type { ComponentChildren } from 'preact';
import type { ModelInfo, WidgetTheme } from '../lib/types';
import { fetchModelInfo, fetchTheme } from './api';
import { useChat } from './state';
import { Launcher } from './components/Launcher';
import { Panel } from './components/Panel';

const LAUNCHER_HINT_MS = 6500;

export interface AppProps {
	slug: string;
	apiBase?: string;
	initialOpen: boolean;
	inline: boolean;
	themeOverride: Partial<WidgetTheme> | null;
	onThemeChange?: (theme: WidgetTheme) => void;
}

export function App(props: AppProps): ComponentChildren {
	const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
	const [theme, setTheme] = useState<WidgetTheme>({});
	const [loadError, setLoadError] = useState<string | null>(null);
	const [isOpen, setIsOpen] = useState<boolean>(props.initialOpen || props.inline);
	const [showHint, setShowHint] = useState<boolean>(false);
	const [size, setSize] = useState<'normal' | 'large'>('normal');
	const [inputValue, setInputValue] = useState<string>('');
	const [focusTrigger, setFocusTrigger] = useState(0);

	// Resolve the effective theme with admin-preview overrides merged on top.
	const effectiveTheme: WidgetTheme = useMemo(() => {
		if (props.themeOverride) return { ...theme, ...props.themeOverride };
		return theme;
	}, [theme, props.themeOverride]);

	// Fetch model info + theme when the slug changes.
	useEffect(() => {
		let cancelled = false;
		setLoadError(null);
		setModelInfo(null);
		Promise.all([
			fetchModelInfo(props.slug, props.apiBase),
			fetchTheme(props.slug, props.apiBase)
		])
			.then(([info, themeData]) => {
				if (cancelled) return;
				setModelInfo(info);
				setTheme(themeData);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				const msg =
					err instanceof Error && err.message === 'not_found'
						? 'Model not found'
						: 'Failed to load widget';
				setLoadError(msg);
			});
		return () => {
			cancelled = true;
		};
	}, [props.slug, props.apiBase]);

	// Launcher hint auto-hide. Only runs when we're in floating (non-inline)
	// mode, the widget is closed, and the theme provides a hint string.
	useEffect(() => {
		if (props.inline) return;
		if (isOpen) return;
		const hint = effectiveTheme.launcher_hint?.trim();
		if (!hint) return;
		setShowHint(true);
		const t = setTimeout(() => setShowHint(false), LAUNCHER_HINT_MS);
		return () => clearTimeout(t);
	}, [props.inline, isOpen, effectiveTheme.launcher_hint]);

	// Notify the hosting element whenever the resolved theme changes so it
	// can update the host-level CSS custom properties.
	useEffect(() => {
		props.onThemeChange?.(effectiveTheme);
	}, [effectiveTheme, props.onThemeChange]);

	// Escape closes the panel (non-inline only).
	useEffect(() => {
		if (props.inline || !isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setIsOpen(false);
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [props.inline, isOpen]);

	// Body scroll lock for mobile fullscreen. When the panel covers the
	// entire viewport (≤640px), prevent the parent page from scrolling
	// underneath. Without this, focusing the textarea triggers the browser's
	// native "scroll focused element into view" behavior which scrolls the
	// PARENT page instead of the panel — pushing the chat out of view.
	// Same pattern Intercom/Drift use for their mobile overlays.
	useEffect(() => {
		if (props.inline || !isOpen) return;
		if (typeof window === 'undefined') return;
		// Only lock on mobile-width viewports where the panel goes fullscreen.
		if (window.innerWidth > 640) return;
		const scrollY = window.scrollY;
		const html = document.documentElement;
		const body = document.body;
		const saved = {
			htmlOverflow: html.style.overflow,
			bodyOverflow: body.style.overflow,
			position: body.style.position,
			width: body.style.width,
			top: body.style.top
		};
		// Lock both <html> AND <body> — iOS Safari ignores overflow:hidden
		// on body alone and still allows rubber-band scrolling.
		html.style.overflow = 'hidden';
		body.style.overflow = 'hidden';
		body.style.position = 'fixed';
		body.style.width = '100%';
		body.style.top = `-${scrollY}px`;
		return () => {
			html.style.overflow = saved.htmlOverflow;
			body.style.overflow = saved.bodyOverflow;
			body.style.position = saved.position;
			body.style.width = saved.width;
			body.style.top = saved.top;
			window.scrollTo(0, scrollY);
		};
	}, [props.inline, isOpen]);

	const chat = useChat({
		slug: props.slug,
		apiBase: props.apiBase,
		modelInfo,
		theme: effectiveTheme
	});

	const handleSubmit = useCallback(() => {
		const message = inputValue.trim();
		if (!message) return;
		setInputValue('');
		void chat.send(message);
		// Bump trigger so Input refocuses the textarea — keeps the mobile
		// keyboard open between messages instead of dismissing it on send.
		setFocusTrigger((n) => n + 1);
	}, [inputValue, chat]);

	const handleSuggestion = useCallback(
		(text: string) => {
			if (chat.isSending) return;
			void chat.send(text);
			setFocusTrigger((n) => n + 1);
		},
		[chat]
	);

	const handleOpen = useCallback(() => {
		setIsOpen(true);
		setShowHint(false);
	}, []);

	const handleClose = useCallback(() => {
		setIsOpen(false);
	}, []);

	const handleToggleSize = useCallback(() => {
		setSize((s) => (s === 'normal' ? 'large' : 'normal'));
	}, []);

	// Early exits.
	if (loadError) {
		// Silently fail for end users — nothing visible, but log for diagnostics.
		console.warn('[ragr-chat]', loadError);
		return null;
	}
	if (!modelInfo) {
		return null;
	}
	if (!modelInfo.accepting_requests && !props.inline) {
		// Floating widget: hide entirely when the model isn't accepting requests.
		// Inline mode still renders so the admin can see the panel's "unavailable"
		// state.
		return null;
	}

	const sampleMessages = modelInfo.sample_messages ?? [];
	const showSampleMessagesInGreeting = effectiveTheme.show_sample_messages_in_greeting ?? true;

	if (props.inline) {
		return html`
			<${Panel}
				modelInfo=${modelInfo}
				theme=${effectiveTheme}
				messages=${chat.messages}
				sampleMessages=${sampleMessages}
				showSampleMessagesInGreeting=${showSampleMessagesInGreeting}
				inputValue=${inputValue}
				isSending=${chat.isSending}
				error=${chat.error}
				size=${size}
				inline=${true}
				focusTrigger=${focusTrigger}
				onInput=${setInputValue}
				onSubmit=${handleSubmit}
				onSuggestion=${handleSuggestion}
				onClose=${handleClose}
				onToggleSize=${handleToggleSize}
			/>
		`;
	}

	return html`
		<div class="ragr-root" data-open=${isOpen ? 'true' : 'false'}>
			${isOpen
				? html`
						<${Panel}
							modelInfo=${modelInfo}
							theme=${effectiveTheme}
							messages=${chat.messages}
							sampleMessages=${sampleMessages}
							showSampleMessagesInGreeting=${showSampleMessagesInGreeting}
							inputValue=${inputValue}
							isSending=${chat.isSending}
							error=${chat.error}
							size=${size}
							inline=${false}
							onInput=${setInputValue}
							onSubmit=${handleSubmit}
							onSuggestion=${handleSuggestion}
							onClose=${handleClose}
							onToggleSize=${handleToggleSize}
						/>
					`
				: html`
						<${Launcher}
							hintText=${effectiveTheme.launcher_hint?.trim() || ''}
							showHint=${showHint}
							modelName=${modelInfo.name}
							onOpen=${handleOpen}
						/>
					`}
		</div>
	`;
}
