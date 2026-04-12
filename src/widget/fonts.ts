// Google Fonts loader.
//
// Fonts loaded via @font-face inside a Shadow DOM are inconsistent across
// browsers — sometimes the shadow tree sees the family, sometimes it
// doesn't, and @font-face declarations inside a shadow root are occasionally
// ignored. The robust approach is to inject a <link> into the document head:
// once a @font-face family is registered at the document level, it is
// available to every shadow tree on the page automatically.
//
// Dedup across multiple <ragr-chat> instances via a module-level Set so we
// only create one <link> per family per page load.
const loadedFonts = new Set<string>();

export function ensureGoogleFont(family: string | null | undefined): void {
	if (!family) return;
	const trimmed = family.trim();
	if (!trimmed || loadedFonts.has(trimmed)) return;
	if (typeof document === 'undefined') return;
	loadedFonts.add(trimmed);

	const link = document.createElement('link');
	link.rel = 'stylesheet';
	// Request 400 / 500 / 600 weights which cover the widget's typographic
	// range (body, send button, title). Customers can still use heavier
	// weights if their chosen family ships them — the browser will fall back
	// to synthetic bold if not.
	link.href =
		'https://fonts.googleapis.com/css2?family=' +
		encodeURIComponent(trimmed).replace(/%20/g, '+') +
		':wght@400;500;600&display=swap';
	link.setAttribute('data-ragr-font', trimmed);
	document.head.appendChild(link);
}
