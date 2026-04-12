// Launcher — the floating button shown when the widget is closed.
//
// Renders two things:
//   1. An optional hint callout ("Ask me anything!") that appears on initial
//      load for LAUNCHER_HINT_MS then auto-hides. Controlled by the parent
//      via `showHint`.
//   2. The circular chat button itself with a speech-bubble glyph.
//
// The launcher is hidden entirely when the widget is in `inline` mode.
import { html } from 'htm/preact';
import type { ComponentChildren } from 'preact';

export interface LauncherProps {
	hintText: string;
	showHint: boolean;
	modelName: string;
	onOpen: () => void;
}

export function Launcher(props: LauncherProps): ComponentChildren {
	return html`
		<div class="ragr-launcher-wrap">
			${props.showHint && props.hintText
				? html`<div class="ragr-launcher-hint" role="status">${props.hintText}</div>`
				: null}
			<button
				type="button"
				class="ragr-launcher-btn"
				aria-label=${`Open ${props.modelName || 'chat'}`}
				title=${`Open ${props.modelName || 'chat'}`}
				onClick=${props.onOpen}
			>
				<svg class="ragr-launcher-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path
						d="M8 10h8M8 14h5M12 3C7.03 3 3 6.58 3 11c0 2.02.84 3.87 2.23 5.29L5 21l4.08-1.91c.92.25 1.9.38 2.92.38 4.97 0 9-3.58 9-8s-4.03-8.47-9-8.47z"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
	`;
}
