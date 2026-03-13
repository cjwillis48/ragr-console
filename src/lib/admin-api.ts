import { env } from '$env/dynamic/public';
import type { RagModel, RagModelCreate, RagModelUpdate, WidgetTheme, StatsResponse, ConversationListResponse, SourceListResponse, CreateSourceRequest, CreateSourceResponse, ChunkListResponse, ChunkDetail, ApiKeyRead, ApiKeyCreateResponse } from './admin-types';

const baseUrl = () => env.PUBLIC_RAGR_API_URL;

let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
	_getToken = fn;
}

async function getAuthHeader(): Promise<string> {
	if (!_getToken) throw new Error('Auth not initialized');
	const token = await _getToken();
	if (!token) throw new Error('Not authenticated');
	return `Bearer ${token}`;
}

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
	const auth = await getAuthHeader();
	const res = await fetch(`${baseUrl()}${path}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			authorization: auth,
			...options.headers
		}
	});
	if (res.status === 401 || res.status === 403) {
		throw new Error('Unauthorized — please sign in again');
	}
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`${res.status}: ${body}`);
	}
	return res;
}

// Models
export async function listModels(): Promise<RagModel[]> {
	const res = await authedFetch('/models');
	return res.json();
}

export async function getModel(slug: string): Promise<RagModel> {
	const res = await authedFetch(`/models/${slug}`);
	return res.json();
}

export async function createModel(data: RagModelCreate): Promise<RagModel> {
	const res = await authedFetch('/models', { method: 'POST', body: JSON.stringify(data) });
	return res.json();
}

export async function updateModel(slug: string, data: RagModelUpdate): Promise<RagModel> {
	const res = await authedFetch(`/models/${slug}`, { method: 'PATCH', body: JSON.stringify(data) });
	return res.json();
}

export async function deleteModel(slug: string): Promise<void> {
	await authedFetch(`/models/${slug}`, { method: 'DELETE' });
}

// Theme
export async function getTheme(slug: string): Promise<WidgetTheme> {
	const res = await fetch(`${baseUrl()}/models/${slug}/theme`);
	if (!res.ok) throw new Error(`Failed to load theme (${res.status})`);
	return res.json();
}

export async function updateTheme(slug: string, data: Partial<WidgetTheme>): Promise<WidgetTheme> {
	const res = await authedFetch(`/models/${slug}/theme`, { method: 'PATCH', body: JSON.stringify(data) });
	return res.json();
}

// Stats
export async function getStats(slug: string): Promise<StatsResponse> {
	const res = await authedFetch(`/models/${slug}/stats`);
	return res.json();
}

// Conversations
export async function getConversations(slug: string, limit = 50, offset = 0): Promise<ConversationListResponse> {
	const res = await authedFetch(`/models/${slug}/conversations?limit=${limit}&offset=${offset}`);
	return res.json();
}

// Sources
export async function getSources(slug: string): Promise<SourceListResponse> {
	const res = await authedFetch(`/models/${slug}/sources`);
	return res.json();
}

export async function createSource(slug: string, data: CreateSourceRequest): Promise<CreateSourceResponse> {
	const res = await authedFetch(`/models/${slug}/sources`, { method: 'POST', body: JSON.stringify(data) });
	return res.json();
}

export async function deleteSource(slug: string, sourceId: number): Promise<void> {
	await authedFetch(`/models/${slug}/sources/${sourceId}`, { method: 'DELETE' });
}

export async function getSourceChunks(slug: string, sourceId: number): Promise<ChunkListResponse> {
	const res = await authedFetch(`/models/${slug}/sources/${sourceId}/chunks`);
	return res.json();
}

export async function getChunksByIds(slug: string, ids: number[]): Promise<ChunkDetail[]> {
	const res = await authedFetch(`/models/${slug}/chunks?ids=${ids.join(',')}`);
	return res.json();
}

export async function deleteAllSources(slug: string): Promise<void> {
	await authedFetch(`/models/${slug}/sources`, { method: 'DELETE' });
}

export async function uploadSources(slug: string, files: FileList): Promise<CreateSourceResponse[]> {
	const auth = await getAuthHeader();
	const formData = new FormData();
	for (const file of files) {
		formData.append('files', file);
	}
	const res = await fetch(`${baseUrl()}/models/${slug}/sources/upload`, {
		method: 'POST',
		headers: { authorization: auth },
		body: formData
	});
	if (!res.ok) throw new Error(`Upload failed (${res.status})`);
	return res.json();
}

// API Keys
export async function listApiKeys(slug: string): Promise<ApiKeyRead[]> {
	const res = await authedFetch(`/models/${slug}/api-keys`);
	return res.json();
}

export async function createApiKey(slug: string, label: string): Promise<ApiKeyCreateResponse> {
	const res = await authedFetch(`/models/${slug}/api-keys`, {
		method: 'POST',
		body: JSON.stringify({ label })
	});
	return res.json();
}

export async function revokeApiKey(slug: string, keyId: number): Promise<void> {
	await authedFetch(`/models/${slug}/api-keys/${keyId}`, { method: 'DELETE' });
}
