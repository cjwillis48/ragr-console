// Build-time constants, injected by vite.widget.config.ts via `define`.
//
// PUBLIC_RAGR_API_URL is the base URL for the RAGR backend API — one value
// per deploy environment (staging, prod). It is inlined into the bundle at
// build time so the widget has no dependency on any runtime config service.
//
// WIDGET_VERSION is the short git SHA of the build, surfaced in console
// diagnostics to make customer bug reports actionable.
declare global {
	interface ImportMetaEnv {
		readonly PUBLIC_RAGR_API_URL: string;
		readonly WIDGET_VERSION: string;
	}
}

export const API_BASE: string =
	(import.meta.env.PUBLIC_RAGR_API_URL as string) || 'http://localhost:8000';

export const WIDGET_VERSION: string =
	(import.meta.env.WIDGET_VERSION as string) || 'dev';
