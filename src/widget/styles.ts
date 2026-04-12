// Widget stylesheet.
//
// Exported as a single string that the custom element injects into its
// shadow root on first mount. Kept as a template literal (not a .css file)
// so vite-build-lib can bundle it into the single-file IIFE without any
// extra loader config.
//
// Design notes:
//   - `:host { all: initial }` resets inherited customer-page styles before
//     we apply our own baseline. Every property the widget uses is set
//     explicitly below.
//   - Theme tokens come from CSS custom properties applied on the host
//     element by src/widget/theme.ts — so the admin preview can drive live
//     updates without re-rendering the Preact tree.
//   - Three discrete panel sizes. The expand toggle swaps `data-size`
//     between "normal" and "large"; the `@media (max-width: 640px)` rule
//     forces fullscreen regardless of data-size and hides the expand
//     button (it's meaningless at full width).
//   - Animations only transition `transform`, `opacity`, `width`, and
//     `height`. No top/left transitions, no layout-thrashing JS
//     measurement.
export const STYLES = /* css */ `
:host {
	/* Token defaults (src/widget/theme.ts overrides these on the host element). */
	--ragr-primary: #6366f1;
	--ragr-bg: #0f172a;
	--ragr-text: #e2e8f0;
	--ragr-user-bubble: #4f46e5;
	--ragr-bot-bubble: #1e293b;
	--ragr-radius: 12px;
	--ragr-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
	--ragr-border: color-mix(in srgb, var(--ragr-text) 20%, transparent);
	--ragr-soft-fill: color-mix(in srgb, var(--ragr-text) 10%, var(--ragr-bg));

	/* Baseline isolation. */
	all: initial;
	box-sizing: border-box;
	font-family: var(--ragr-font);
	font-size: 14px;
	line-height: 1.5;
	color: var(--ragr-text);
	color-scheme: normal;

	/* Floating default. Inline mode overrides below. */
	position: fixed;
	right: 1rem;
	bottom: 1rem;
	/* Max signed 32-bit z-index minus a hair so customer modals can still go above. */
	z-index: 2147483000;

	/* Prevent text selection on UI chrome by default; bubbles opt back in. */
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

:host([inline]) {
	position: static;
	right: auto;
	bottom: auto;
	z-index: auto;
	display: block;
	width: 100%;
	height: 100%;
}

*, *::before, *::after { box-sizing: border-box; }

button {
	appearance: none;
	border: 0;
	background: transparent;
	cursor: pointer;
	font: inherit;
	color: inherit;
	padding: 0;
}
button:disabled { cursor: not-allowed; }

textarea {
	appearance: none;
	font: inherit;
	color: inherit;
	background: transparent;
	border: 0;
	outline: 0;
	resize: none;
}

p { margin: 0; }
svg { display: block; }

.ragr-root { display: block; }

/* ======================================================================
   LAUNCHER
   ====================================================================== */

.ragr-launcher-wrap {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 0.5rem;
}

.ragr-launcher-hint {
	background: var(--ragr-bg);
	color: var(--ragr-text);
	border: 1px solid var(--ragr-border);
	border-radius: 12px;
	padding: 0.5rem 0.75rem;
	font-size: 12px;
	max-width: 240px;
	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
	animation: ragr-hint-in 260ms cubic-bezier(0.2, 0.7, 0.2, 1);
	transform-origin: bottom right;
}

@keyframes ragr-hint-in {
	from { opacity: 0; transform: translateX(12px) scale(0.96); }
	to   { opacity: 1; transform: translateX(0)    scale(1); }
}

.ragr-launcher-btn {
	width: 56px;
	height: 56px;
	border-radius: 999px;
	background: var(--ragr-primary);
	color: #ffffff;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 6px 24px rgba(0, 0, 0, 0.24);
	transition: transform 180ms cubic-bezier(0.2, 0.7, 0.2, 1),
		box-shadow 180ms ease;
	animation: ragr-launcher-in 320ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.ragr-launcher-btn:hover {
	transform: translateY(-1px) scale(1.03);
	box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
}
.ragr-launcher-btn:active {
	transform: scale(0.96);
}
.ragr-launcher-icon { width: 24px; height: 24px; }

@keyframes ragr-launcher-in {
	from { opacity: 0; transform: translateX(24px) scale(0.9); }
	to   { opacity: 1; transform: translateX(0)    scale(1); }
}

/* ======================================================================
   PANEL
   ====================================================================== */

.ragr-panel {
	position: absolute;
	right: 0;
	bottom: 0;
	width: 384px;
	height: 576px;
	max-width: calc(100vw - 2rem);
	max-height: calc(100dvh - 2rem);
	display: flex;
	flex-direction: column;
	background: var(--ragr-bg);
	color: var(--ragr-text);
	border: 1px solid var(--ragr-border);
	border-radius: calc(var(--ragr-radius) + 4px);
	overflow: hidden;
	box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
	transform-origin: bottom right;
	animation: ragr-panel-in 220ms cubic-bezier(0.32, 0.72, 0.24, 1);
	transition: width 220ms cubic-bezier(0.32, 0.72, 0.24, 1),
		height 220ms cubic-bezier(0.32, 0.72, 0.24, 1);
}

.ragr-panel[data-size="large"] {
	width: 520px;
	height: 720px;
}

@keyframes ragr-panel-in {
	from { opacity: 0; transform: translateY(12px) scale(0.97); }
	to   { opacity: 1; transform: translateY(0)    scale(1); }
}

.ragr-panel-inline {
	position: static;
	width: 100%;
	height: 100%;
	max-width: none;
	max-height: none;
	border-radius: 0;
	border: 0;
	box-shadow: none;
	animation: none;
	transition: none;
}

/* Mobile — fullscreen, hide expand button. */
@media (max-width: 640px) {
	:host(:not([inline])) .ragr-panel,
	:host(:not([inline])) .ragr-panel[data-size="large"] {
		position: fixed;
		inset: 0;
		/* Let inset:0 derive the size — no explicit width/height. Using
		   100dvh here would prevent the panel from shrinking when the
		   mobile virtual keyboard opens, because the explicit height
		   overrides the inset-derived height. With inset:0 alone the
		   browser adjusts bottom:0 to sit above the keyboard. */
		width: auto;
		height: auto;
		max-width: none;
		max-height: none;
		border-radius: 0;
		border: 0;
	}
	/* Higher specificity than .ragr-icon-btn below so this wins the cascade.
	   Media queries do not add specificity, so without the compound selector
	   the later .ragr-icon-btn { display: inline-flex } rule overrides this. */
	.ragr-icon-btn.ragr-expand-btn { display: none; }
}

/* ---- Header ---- */

.ragr-header {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.75rem 1rem;
	border-bottom: 1px solid var(--ragr-border);
	flex-shrink: 0;
}
.ragr-header-title {
	flex: 1;
	min-width: 0;
}
.ragr-title {
	font-weight: 600;
	font-size: 14px;
	color: var(--ragr-text);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.ragr-subtitle {
	font-size: 11px;
	opacity: 0.7;
	margin-top: 1px;
}

.ragr-header-actions {
	display: flex;
	align-items: center;
	gap: 0.25rem;
}

.ragr-icon-btn {
	width: 28px;
	height: 28px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border-radius: 8px;
	color: var(--ragr-text);
	opacity: 0.7;
	transition: opacity 160ms ease, background 160ms ease;
}
.ragr-icon-btn:hover {
	opacity: 1;
	background: var(--ragr-soft-fill);
}
.ragr-icon-btn svg { width: 14px; height: 14px; }

/* ---- Messages ---- */

.ragr-messages {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	padding: 0.75rem 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	scrollbar-width: thin;
	scrollbar-color: var(--ragr-border) transparent;
}
.ragr-messages::-webkit-scrollbar { width: 8px; }
.ragr-messages::-webkit-scrollbar-track { background: transparent; }
.ragr-messages::-webkit-scrollbar-thumb {
	background: var(--ragr-border);
	border-radius: 4px;
}

.ragr-row { display: flex; }
.ragr-row-user { justify-content: flex-end; }
.ragr-row-bot  { justify-content: flex-start; }

.ragr-bubble {
	max-width: 85%;
	padding: 0.5rem 0.75rem;
	font-size: 13.5px;
	line-height: 1.5;
	border-radius: var(--ragr-radius);
	/* break-word only wraps long single tokens (URLs, code spans) when they
	   wouldn't otherwise fit. overflow-wrap:anywhere is too aggressive — it
	   can orphan trailing punctuation (e.g. a period) onto a new line after
	   a link. */
	overflow-wrap: break-word;
	-webkit-user-select: text;
	user-select: text;
}

/* Bot bubbles are wrapped in .ragr-bubble-group which already enforces the
   85% width cap. The redundant max-width on the bubble itself combines with
   the group's flex-column stretch to create a feedback loop where the bubble
   ends up narrower than its own min-content — visible as the typing dots
   overflowing the bubble's right padding. Reset it for grouped bubbles. */
.ragr-bubble-group > .ragr-bubble {
	max-width: none;
}

.ragr-bubble-user {
	background: var(--ragr-user-bubble);
	color: #ffffff;
	white-space: pre-wrap;
}

.ragr-bubble-bot {
	background: var(--ragr-bot-bubble);
	color: var(--ragr-text);
}

.ragr-bubble-error {
	border: 1px solid rgba(244, 63, 94, 0.4);
}

.ragr-bubble-group {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
	max-width: 85%;
}

/* Animated three-dot typing indicator shown while the assistant is
   streaming its first token. Dots use currentColor so they inherit the
   bubble text color and automatically match the theme. The stagger delay
   creates a wave effect without overlapping animations. */
.ragr-typing {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	padding: 4px 0;
	line-height: 1;
	/* Belt-and-suspenders: drop any whitespace text that might sneak in
	   between the dot spans so the bubble's content width stays symmetric. */
	font-size: 0;
}
.ragr-typing-dot {
	display: inline-block;
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: currentColor;
	opacity: 0.35;
	animation: ragr-typing-bounce 1.2s ease-in-out infinite;
}
.ragr-typing-dot:nth-child(2) { animation-delay: 0.15s; }
.ragr-typing-dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes ragr-typing-bounce {
	0%, 60%, 100% {
		opacity: 0.35;
		transform: translateY(0);
	}
	30% {
		opacity: 1;
		transform: translateY(-3px);
	}
}

/* Respect users who've opted out of motion — fall back to a gentle
   opacity pulse with no translation. */
@media (prefers-reduced-motion: reduce) {
	.ragr-typing-dot {
		animation: ragr-typing-pulse 1.4s ease-in-out infinite;
	}
	@keyframes ragr-typing-pulse {
		0%, 100% { opacity: 0.35; }
		50% { opacity: 0.85; }
	}
}

.ragr-markdown { font-size: 13.5px; line-height: 1.5; }
.ragr-markdown > *:first-child { margin-top: 0; }
.ragr-markdown > *:last-child { margin-bottom: 0; }
.ragr-markdown p { margin: 0.5em 0; }
.ragr-markdown a {
	color: inherit;
	text-decoration: underline;
	/* Allow long URLs to break within themselves, but not short link text. */
	overflow-wrap: break-word;
}
.ragr-markdown code {
	font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	font-size: 0.92em;
	background: color-mix(in srgb, var(--ragr-text) 12%, transparent);
	padding: 0.1em 0.3em;
	border-radius: 4px;
}
.ragr-markdown pre {
	background: color-mix(in srgb, var(--ragr-text) 8%, transparent);
	padding: 0.5rem 0.75rem;
	border-radius: 6px;
	overflow-x: auto;
	margin: 0.5em 0;
}
.ragr-markdown pre code {
	background: transparent;
	padding: 0;
	font-size: 0.92em;
}
.ragr-markdown ul,
.ragr-markdown ol {
	margin: 0.5em 0;
	padding-left: 1.25em;
}
.ragr-markdown ul { list-style: disc; }
.ragr-markdown ol { list-style: decimal; }
.ragr-markdown h1,
.ragr-markdown h2,
.ragr-markdown h3 {
	margin: 0.75em 0 0.25em;
	font-weight: 600;
	line-height: 1.3;
}
.ragr-markdown h1 { font-size: 1.15em; }
.ragr-markdown h2 { font-size: 1.08em; }
.ragr-markdown h3 { font-size: 1em; }
.ragr-markdown blockquote {
	margin: 0.5em 0;
	padding-left: 0.75em;
	border-left: 2px solid var(--ragr-border);
	opacity: 0.85;
}

.ragr-suggestions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.375rem;
}
.ragr-suggestion {
	padding: 0.25rem 0.625rem;
	border-radius: 8px;
	font-size: 11px;
	line-height: 1.3;
	background: var(--ragr-soft-fill);
	color: var(--ragr-text);
	border: 1px solid var(--ragr-border);
	transition: opacity 160ms ease, transform 160ms ease;
	text-align: left;
}
.ragr-suggestion:hover {
	opacity: 0.85;
	transform: translateY(-1px);
}
.ragr-suggestion:active { transform: translateY(0); }

/* ---- Error + Unavailable ---- */

.ragr-error-bar {
	padding: 0.375rem 1rem;
	background: rgba(244, 63, 94, 0.12);
	color: #fca5a5;
	font-size: 11px;
	text-align: center;
	border-top: 1px solid rgba(244, 63, 94, 0.3);
	flex-shrink: 0;
}

.ragr-unavailable {
	padding: 0.75rem 1rem;
	font-size: 12px;
	text-align: center;
	opacity: 0.7;
	border-top: 1px solid var(--ragr-border);
	flex-shrink: 0;
}

/* ---- Input ---- */

.ragr-input-form {
	padding: 0.625rem 0.75rem;
	border-top: 1px solid var(--ragr-border);
	flex-shrink: 0;
}

.ragr-input-row {
	display: flex;
	align-items: flex-end;
	gap: 0.5rem;
}

.ragr-textarea {
	flex: 1;
	min-height: 40px;
	max-height: 140px;
	padding: 0.5rem 0.75rem;
	background: var(--ragr-soft-fill);
	color: var(--ragr-text);
	border: 1px solid var(--ragr-border);
	border-radius: var(--ragr-radius);
	font-size: 13.5px;
	line-height: 1.4;
	resize: vertical;
	transition: border-color 160ms ease;
}
.ragr-textarea::placeholder {
	color: color-mix(in srgb, var(--ragr-text) 45%, transparent);
}
.ragr-textarea:focus {
	border-color: var(--ragr-primary);
}

.ragr-send {
	width: 40px;
	height: 40px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	background: var(--ragr-primary);
	color: #ffffff;
	border-radius: var(--ragr-radius);
	transition: opacity 160ms ease, transform 160ms ease;
	flex-shrink: 0;
}
.ragr-send:hover:not(:disabled) { transform: translateY(-1px); }
.ragr-send:active:not(:disabled) { transform: translateY(0); }
.ragr-send:disabled { opacity: 0.4; }
.ragr-send-icon { width: 16px; height: 16px; }
.ragr-send-dots { font-weight: 600; font-size: 18px; line-height: 1; }

.ragr-sr-only {
	position: absolute;
	width: 1px; height: 1px; padding: 0; margin: -1px;
	overflow: hidden; clip: rect(0, 0, 0, 0);
	white-space: nowrap; border: 0;
}
`;
