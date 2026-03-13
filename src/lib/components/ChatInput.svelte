<script lang="ts">
	let {
		placeholder = 'Type a message...',
		disabled = false,
		onsend
	}: { placeholder?: string; disabled?: boolean; onsend: (text: string) => void } = $props();

	let text = $state('');

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function send() {
		const trimmed = text.trim();
		if (!trimmed || disabled) return;
		onsend(trimmed);
		text = '';
	}
</script>

<form class="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0" onsubmit={(e) => { e.preventDefault(); send(); }}>
	<div class="max-w-3xl mx-auto flex items-end gap-2">
		<label for="chat-input" class="sr-only">Send a message</label>
		<textarea
			id="chat-input"
			bind:value={text}
			onkeydown={handleKeydown}
			{placeholder}
			{disabled}
			rows="2"
			maxlength="2000"
			class="min-h-[2.75rem] max-h-28 flex-1 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm
				text-slate-900 placeholder-slate-400
				focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200
				dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500
				dark:focus:border-indigo-400 dark:focus:ring-indigo-900/40
				disabled:cursor-not-allowed disabled:opacity-50"
		></textarea>
		<button
			type="submit"
			disabled={disabled || !text.trim()}
			class="h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white
				transition-colors hover:bg-indigo-500
				disabled:cursor-not-allowed disabled:opacity-50"
		>
			{disabled ? '...' : 'Send'}
		</button>
	</div>
</form>
