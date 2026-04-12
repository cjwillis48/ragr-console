// <ragr-chat> custom element.
//
// Responsibilities:
//   - Attach an open shadow root on construction (no network).
//   - Inject the static stylesheet into the shadow root on first mount.
//   - Mount a Preact tree into the shadow root on connectedCallback.
//   - Surface attributes (slug, api-base, open, inline) as reactive props on
//     the Preact tree.
//   - When the Preact tree resolves a theme, apply CSS custom properties
//     on the host element and ensure the Google Font is loaded.
//   - Expose an imperative `themeOverride` property for the admin preview
//     pane to drive unsaved theme edits without refetching.
//   - Tear down the Preact tree and cancel in-flight work on disconnect.
//
// Shadow root mode is `open` so Playwright locators, admin preview tooling,
// and devtools inspection all work. A closed shadow root offers no
// meaningful additional protection against a hostile host page.
import { render, h } from 'preact';
import { App } from './app';
import { STYLES } from './styles';
import { applyThemeVars } from './theme';
import { ensureGoogleFont } from './fonts';
import type { WidgetTheme } from '../lib/types';

const ATTR_SLUG = 'slug';
const ATTR_API_BASE = 'api-base';
const ATTR_OPEN = 'open';
const ATTR_INLINE = 'inline';

export class RagrChatElement extends HTMLElement {
	static observedAttributes = [ATTR_SLUG, ATTR_API_BASE, ATTR_OPEN, ATTR_INLINE];

	#shadow: ShadowRoot;
	#mounted = false;
	#styleInjected = false;
	#themeOverride: Partial<WidgetTheme> | null = null;
	#lastFontFamily: string | null = null;

	constructor() {
		super();
		this.#shadow = this.attachShadow({ mode: 'open' });
	}

	// Imperative API for the admin theme preview pane.
	get themeOverride(): Partial<WidgetTheme> | null {
		return this.#themeOverride;
	}
	set themeOverride(value: Partial<WidgetTheme> | null) {
		this.#themeOverride = value;
		if (this.#mounted) this.#rerender();
	}

	connectedCallback() {
		this.#mounted = true;
		if (!this.#styleInjected) {
			const style = document.createElement('style');
			style.textContent = STYLES;
			this.#shadow.appendChild(style);
			this.#styleInjected = true;
		}
		this.#rerender();
	}

	disconnectedCallback() {
		this.#mounted = false;
		render(null, this.#shadow);
	}

	attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null) {
		if (!this.#mounted || oldValue === newValue) return;
		this.#rerender();
	}

	#handleThemeChange = (theme: WidgetTheme) => {
		applyThemeVars(this, theme);
		if (theme.font_family && theme.font_family !== this.#lastFontFamily) {
			this.#lastFontFamily = theme.font_family;
			ensureGoogleFont(theme.font_family);
		}
	};

	#rerender() {
		const slug = this.getAttribute(ATTR_SLUG);
		if (!slug) {
			console.warn('[ragr-chat] missing required "slug" attribute');
			render(null, this.#shadow);
			return;
		}

		const apiBase = this.getAttribute(ATTR_API_BASE) || undefined;
		const initialOpen = this.hasAttribute(ATTR_OPEN);
		const inline = this.hasAttribute(ATTR_INLINE);

		// Apply default theme vars immediately so the initial paint has
		// the defaults applied, avoiding a flash of unset custom properties.
		applyThemeVars(this, {});

		render(
			h(App, {
				slug,
				apiBase,
				initialOpen,
				inline,
				themeOverride: this.#themeOverride,
				onThemeChange: this.#handleThemeChange
			}),
			this.#shadow
		);
	}
}
