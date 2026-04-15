// Google Fonts loader with allowlist enforcement.
//
// Fonts loaded via @font-face inside a Shadow DOM are inconsistent across
// browsers — sometimes the shadow tree sees the family, sometimes it
// doesn't, and @font-face declarations inside a shadow root are occasionally
// ignored. The robust approach is to inject a <link> into the document head:
// once a @font-face family is registered at the document level, it is
// available to every shadow tree on the page automatically.
//
// Security: the font_family value comes from the backend theme response,
// which the model owner controls via the admin panel. We validate against
// the same allowlist the admin UI uses (src/lib/font-allowlist.ts) so a
// compromised backend or direct DB edit can't inject arbitrary font names
// into the Google Fonts CSS endpoint. System fonts (Courier New, Georgia)
// are in the allowlist but skip the <link> injection since they're already
// available on every OS. See security review finding H4.
//
// Dedup across multiple <ragr-chat> instances via a module-level Set so we
// only create one <link> per family per page load. Capped at 8 to prevent
// unbounded <link> injection from a misbehaving backend.
import { ALLOWED_FONT_FAMILIES, SYSTEM_FONTS } from '../lib/font-allowlist';

const MAX_LOADED_FONTS = 8;
const loadedFonts = new Set<string>();
const allowedSet = new Set<string>(ALLOWED_FONT_FAMILIES);

export function ensureGoogleFont(family: string | null | undefined): void {
	if (!family) return;
	const trimmed = family.trim();
	if (!trimmed || loadedFonts.has(trimmed)) return;
	if (typeof document === 'undefined') return;

	// Reject anything not in the shared allowlist.
	if (!allowedSet.has(trimmed)) {
		console.warn(`[ragr-chat] font "${trimmed}" is not in the allowed font list, skipping`);
		return;
	}

	loadedFonts.add(trimmed);

	// System fonts don't need a Google Fonts <link> — they're built into the OS.
	if (SYSTEM_FONTS.has(trimmed)) return;

	// Safety cap — don't inject more than MAX_LOADED_FONTS external stylesheets.
	const externalCount = loadedFonts.size - [...loadedFonts].filter((f) => SYSTEM_FONTS.has(f)).length;
	if (externalCount > MAX_LOADED_FONTS) return;

	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href =
		'https://fonts.googleapis.com/css2?family=' +
		encodeURIComponent(trimmed).replace(/%20/g, '+') +
		':wght@400;500;600&display=swap';
	link.setAttribute('data-ragr-font', trimmed);
	document.head.appendChild(link);
}
