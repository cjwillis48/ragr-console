// Input — the chat textarea + send button.
//
// Keyboard behavior matches the old Svelte embed:
//   - Enter: submit
//   - Shift+Enter: insert newline
//   - Escape (on textarea): bubbles up to the parent for close handling
//
// The textarea is a controlled component. The parent (Panel) owns the current
// input string. This keeps the `send` call in one place and lets us clear the
// textarea immediately on submit without re-entering dirty state.
import { html } from 'htm/preact';
import type { ComponentChildren } from 'preact';
import { useRef, useEffect } from 'preact/hooks';

export interface InputProps {
	value: string;
	placeholder: string;
	disabled: boolean;
	sending: boolean;
	autoFocus: boolean;
	onInput: (value: string) => void;
	onSubmit: () => void;
}

export function Input(props: InputProps): ComponentChildren {
	const ref = useRef<HTMLTextAreaElement | null>(null);

	useEffect(() => {
		if (props.autoFocus && ref.current) {
			// Defer to next frame so the focus happens after the panel open
			// transition has settled, avoiding iOS keyboard jank.
			requestAnimationFrame(() => ref.current?.focus());
		}
	}, [props.autoFocus]);

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			props.onSubmit();
		}
	};

	const handleInput = (e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		props.onInput(target.value);
	};

	return html`
		<form
			class="ragr-input-form"
			onSubmit=${(e: Event) => {
				e.preventDefault();
				props.onSubmit();
			}}
		>
			<label class="ragr-sr-only" for="ragr-chat-input">Ask a question</label>
			<div class="ragr-input-row">
				<textarea
					id="ragr-chat-input"
					ref=${ref}
					class="ragr-textarea"
					rows="2"
					maxlength="2000"
					placeholder=${props.placeholder}
					value=${props.value}
					onInput=${handleInput}
					onKeyDown=${handleKeyDown}
				/>
				<button
					type="submit"
					class="ragr-send"
					disabled=${props.disabled || !props.value.trim()}
					aria-label="Send message"
				>
					${props.sending
						? html`<span class="ragr-send-dots" aria-hidden="true">…</span>`
						: html`<svg
								viewBox="0 0 20 20"
								class="ragr-send-icon"
								fill="none"
								aria-hidden="true"
							>
								<path
									d="M2 10l16-7-7 16-2-7-7-2z"
									stroke="currentColor"
									stroke-width="1.6"
									stroke-linejoin="round"
								/>
							</svg>`}
				</button>
			</div>
		</form>
	`;
}
