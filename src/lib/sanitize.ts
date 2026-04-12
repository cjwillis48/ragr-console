// DOMPurify sanitizer with eager initialization and anchor hardening.
//
// Why eager (not dynamic import): the earlier dynamic-import pattern
// created a race window where `sanitize` was the identity function between
// module load and the `import('dompurify').then(...)` microtask resolving.
// A greeting or bot response rendered before that microtask finished would
// flow raw HTML into `dangerouslySetInnerHTML`. Because the widget now runs
// in the customer's page context (not inside an iframe), any XSS during
// that window lands in customer-site.com with full cookie/storage access.
// Fix: static import so DOMPurify is available synchronously after module
// evaluation. See security review finding C1.
//
// The `typeof window` guard keeps SvelteKit SSR working — the dompurify
// module loads in Node (it lazy-initialises against `window`), but its
// `.sanitize()` and `.addHook()` methods are only called client-side.
//
// The `afterSanitizeAttributes` hook forces every anchor to open in a
// new tab with noopener/noreferrer, AND enforces an explicit href scheme
// allowlist (http, https, mailto, fragment). DOMPurify's default already
// blocks javascript: and data: URLs on `href`, but we do defense-in-depth
// in case a future DOMPurify version loosens the default, and to reject
// any other unexpected scheme.
import DOMPurify from 'dompurify';

const HREF_ALLOWED = /^(?:https?:|mailto:|#)/i;

// addHook only exists on the browser-initialised DOMPurify instance. In
// Node-without-jsdom the default export is a factory with no addHook, so
// guard with a capability check.
if (typeof window !== 'undefined' && typeof DOMPurify.addHook === 'function') {
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (node.tagName !== 'A') return;
		const href = node.getAttribute('href') || '';
		if (!HREF_ALLOWED.test(href)) {
			node.removeAttribute('href');
			return;
		}
		node.setAttribute('target', '_blank');
		node.setAttribute('rel', 'noopener noreferrer');
	});
}

export function sanitizeHtml(html: string): string {
	// SSR: we never actually render sanitized HTML into SSR output — the
	// widget's Preact tree only mounts in the browser after hydration, and
	// SvelteKit routes that call renderMarkdown do so from onMount. But
	// guard anyway so any accidental SSR call returns the raw string
	// instead of crashing on missing `window`.
	if (typeof window === 'undefined') return html;
	return DOMPurify.sanitize(html);
}
