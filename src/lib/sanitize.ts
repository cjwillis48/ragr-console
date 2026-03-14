import { browser } from '$app/environment';

let sanitize: (html: string) => string = (html) => html;

if (browser) {
	import('dompurify').then((mod) => {
		const DOMPurify = mod.default;
		sanitize = (html: string) => DOMPurify.sanitize(html);
	});
}

export function sanitizeHtml(html: string): string {
	return sanitize(html);
}
