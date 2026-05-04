// Canonical list of font families the widget is allowed to load from Google
// Fonts. Shared between the admin UI (font picker dropdown) and the widget
// bundle (ensureGoogleFont validation). If a model owner somehow gets a
// font_family value outside this set into the backend (API bypass, direct DB
// edit), the widget refuses to load it — preventing injection of arbitrary
// CSS from the Google Fonts endpoint into the customer's document.head.
//
// System fonts (Courier New, Georgia) are included in the allowlist but
// don't trigger a Google Fonts <link> injection — they're already available
// on every OS.
export const ALLOWED_FONT_FAMILIES = [
	'Inter',
	'Roboto',
	'Open Sans',
	'Poppins',
	'Montserrat',
	'Merriweather',
	'Playfair Display',
	'Courier New',
	'Georgia',
	'Fira Code',
	'Fredoka One'
] as const;

export const SYSTEM_FONTS = new Set(['Courier New', 'Georgia']);

export type AllowedFontFamily = (typeof ALLOWED_FONT_FAMILIES)[number];
