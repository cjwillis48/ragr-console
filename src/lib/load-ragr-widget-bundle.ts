// Load the embeddable widget IIFE from /widget/ragr-chat.js and wait until
// <ragr-chat> is defined. Used by the marketing page, hosted chat route, and
// admin preview.
//
// We inject a classic script tag instead of import() because the bundle lives
// under static/widget/ outside the SvelteKit/Vite app graph — dynamic import
// would be resolved at build time incorrectly.
//
// Concurrent callers share one in-flight promise. A failed load sets
// data-ragr-bundle-failed on the script so later callers reject instead of
// waiting forever on a dead tag.

const BUNDLE_SRC = '/widget/ragr-chat.js';

export interface LoadRagrWidgetBundleOptions {
	/** Passed to console.warn when the script network-load fails */
	warnMessage?: string;
}

let inflight: Promise<void> | null = null;

export function loadRagrWidgetBundle(options?: LoadRagrWidgetBundleOptions): Promise<void> {
	if (typeof window === 'undefined' || typeof customElements === 'undefined') {
		return Promise.resolve();
	}

	if (customElements.get('ragr-chat')) {
		return Promise.resolve();
	}

	const warnMessage = options?.warnMessage ?? '[ragr] widget bundle failed to load';

	if (!inflight) {
		inflight = loadInternal(warnMessage).finally(() => {
			inflight = null;
		});
	}

	return inflight;
}

async function loadInternal(warnMessage: string): Promise<void> {
	if (customElements.get('ragr-chat')) return;

	const existing = document.querySelector<HTMLScriptElement>('script[data-ragr-bundle]');
	if (existing) {
		await waitForExistingScript(existing, warnMessage);
		return;
	}

	await injectNewScript(warnMessage);
}

function waitForExistingScript(script: HTMLScriptElement, warnMessage: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (customElements.get('ragr-chat')) {
			resolve();
			return;
		}

		if (script.dataset.ragrBundleFailed === '1') {
			console.warn(warnMessage);
			reject(new Error('widget bundle load failed'));
			return;
		}

		let settled = false;

		function cleanup() {
			script.removeEventListener('load', onLoad);
			script.removeEventListener('error', onError);
		}

		function onLoad() {
			if (settled) return;
			settled = true;
			cleanup();
			if (customElements.get('ragr-chat')) {
				resolve();
			} else {
				reject(new Error('widget bundle loaded but custom element missing'));
			}
		}

		function onError() {
			if (settled) return;
			settled = true;
			cleanup();
			script.dataset.ragrBundleFailed = '1';
			console.warn(warnMessage);
			reject(new Error('widget bundle load failed'));
		}

		script.addEventListener('load', onLoad);
		script.addEventListener('error', onError);

		queueMicrotask(() => {
			if (settled) return;
			if (customElements.get('ragr-chat')) {
				settled = true;
				cleanup();
				resolve();
			}
		});
	});
}

function injectNewScript(warnMessage: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = BUNDLE_SRC;
		script.async = true;
		script.dataset.ragrBundle = '1';

		let settled = false;

		function cleanup() {
			script.removeEventListener('load', onLoad);
			script.removeEventListener('error', onError);
		}

		function onLoad() {
			if (settled) return;
			settled = true;
			cleanup();
			if (customElements.get('ragr-chat')) {
				resolve();
			} else {
				reject(new Error('widget bundle loaded but custom element missing'));
			}
		}

		function onError() {
			if (settled) return;
			settled = true;
			cleanup();
			script.dataset.ragrBundleFailed = '1';
			console.warn(warnMessage);
			reject(new Error('widget bundle load failed'));
		}

		script.addEventListener('load', onLoad);
		script.addEventListener('error', onError);
		document.head.appendChild(script);

		queueMicrotask(() => {
			if (settled) return;
			if (customElements.get('ragr-chat')) {
				settled = true;
				cleanup();
				resolve();
			}
		});
	});
}
