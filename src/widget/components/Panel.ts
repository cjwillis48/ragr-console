// Panel — the full chat surface shown when the widget is open.
//
// Layout:
//   ┌──────────────────────────────┐
//   │ Header: title + label        │ [expand] [close]
//   ├──────────────────────────────┤
//   │ Messages (scrollable)        │
//   ├──────────────────────────────┤
//   │ Input form                   │
//   └──────────────────────────────┘
//
// Size modes are driven by the `data-size` attribute ("normal" | "large").
// The CSS in src/widget/styles.ts handles the dimension tokens and a media
// query forces fullscreen on viewports ≤ 640px regardless of data-size.
//
// Close + expand are suppressed in `inline` mode because the host (full-page
// hosted chat or admin preview pane) controls the dimensions.
import { html } from 'htm/preact';
import type { ComponentChildren } from 'preact';
import type { Message, ModelInfo, WidgetTheme } from '../../lib/types';
import { MessageList } from './MessageList';
import { Input } from './Input';

export interface PanelProps {
	modelInfo: ModelInfo | null;
	theme: WidgetTheme;
	messages: Message[];
	sampleQuestions: string[];
	showSampleQuestionsInGreeting: boolean;
	inputValue: string;
	isSending: boolean;
	error: string | null;
	size: 'normal' | 'large';
	inline: boolean;
	onInput: (value: string) => void;
	onSubmit: () => void;
	onSuggestion: (text: string) => void;
	onClose: () => void;
	onToggleSize: () => void;
}

export function Panel(props: PanelProps): ComponentChildren {
	const label = props.theme.label?.trim() || '';
	const placeholder = props.theme.placeholder?.trim() || 'Ask a question…';
	const unavailable = props.modelInfo && !props.modelInfo.accepting_requests;

	return html`
		<section
			class=${`ragr-panel${props.inline ? ' ragr-panel-inline' : ''}`}
			data-size=${props.size}
			role="dialog"
			aria-label=${`${props.modelInfo?.name ?? 'Chat'} assistant`}
		>
			<header class="ragr-header">
				<div class="ragr-header-title">
					<p class="ragr-title">${props.modelInfo?.name ?? 'Chat'}</p>
					${label ? html`<p class="ragr-subtitle">${label}</p>` : null}
				</div>
				<div class="ragr-header-actions">
					${!props.inline
						? html`
								<button
									type="button"
									class="ragr-icon-btn ragr-expand-btn"
									aria-label=${props.size === 'large' ? 'Shrink chat' : 'Expand chat'}
									title=${props.size === 'large' ? 'Shrink' : 'Expand'}
									onClick=${props.onToggleSize}
								>
									${props.size === 'large'
										? html`<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
												<path
													d="M9 2h5v5M7 14H2V9M14 2L9 7M2 14l5-5"
													stroke="currentColor"
													stroke-width="1.6"
													stroke-linecap="round"
												/>
											</svg>`
										: html`<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
												<path
													d="M14 2h-5m5 0v5m0-5L9 7M2 14h5m-5 0V9m0 5l5-5"
													stroke="currentColor"
													stroke-width="1.6"
													stroke-linecap="round"
												/>
											</svg>`}
								</button>
								<button
									type="button"
									class="ragr-icon-btn ragr-close-btn"
									aria-label="Close chat"
									title="Close"
									onClick=${props.onClose}
								>
									<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
										<path
											d="M3 3l10 10M13 3L3 13"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linecap="round"
										/>
									</svg>
								</button>
							`
						: null}
				</div>
			</header>

			<${MessageList}
				messages=${props.messages}
				sampleQuestions=${props.sampleQuestions}
				showSampleQuestionsInGreeting=${props.showSampleQuestionsInGreeting}
				onSuggestion=${props.onSuggestion}
			/>

			${props.error ? html`<div class="ragr-error-bar">${props.error}</div>` : null}
			${unavailable
				? html`<div class="ragr-unavailable">This assistant is currently unavailable.</div>`
				: null}

			<${Input}
				value=${props.inputValue}
				placeholder=${placeholder}
				sending=${props.isSending}
				disabled=${!!unavailable || props.isSending}
				autoFocus=${true}
				onInput=${props.onInput}
				onSubmit=${props.onSubmit}
			/>
		</section>
	`;
}
