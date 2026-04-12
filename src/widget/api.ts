// Thin wrapper around src/lib/api.ts that binds the build-time API base
// URL. Kept separate from src/lib/api.ts (which reads from
// $env/dynamic/public and is SvelteKit-only) so the widget bundle doesn't
// pull any SvelteKit runtime into its output.
import * as core from '../lib/api';
import { API_BASE } from './config';
import type { ModelInfo, WidgetTheme } from '../lib/types';

function baseFor(override?: string): core.ApiConfig {
	return { baseUrl: override || API_BASE };
}

export function fetchModelInfo(slug: string, apiBase?: string): Promise<ModelInfo> {
	return core.fetchModelInfo(baseFor(apiBase), slug);
}

export function fetchTheme(slug: string, apiBase?: string): Promise<WidgetTheme> {
	return core.fetchTheme(baseFor(apiBase), slug);
}

export function streamChat(
	slug: string,
	question: string,
	sessionId: string,
	callbacks: core.StreamCallbacks,
	signal?: AbortSignal,
	apiBase?: string
): Promise<void> {
	return core.streamChat(baseFor(apiBase), slug, question, sessionId, callbacks, signal);
}

export type { StreamCallbacks } from '../lib/api';
