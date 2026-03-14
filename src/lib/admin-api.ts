import { env } from '$env/dynamic/public';
import type { RagModel, RagModelCreate, RagModelUpdate, WidgetTheme, StatsResponse, ConversationListResponse, ConversationDetailResponse, SourceListResponse, CreateSourceRequest, CreateSourceResponse, PresignResponse, ChunkListResponse, ChunkDetail, ApiKeyRead, ApiKeyCreateResponse } from './admin-types';

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

export async function getConversationMessages(slug: string, conversationId: number): Promise<ConversationDetailResponse> {
	const res = await authedFetch(`/models/${slug}/conversations/${conversationId}/messages`);
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
	// Try presigned R2 upload first
	try {
		return await uploadViaPresign(slug, files);
	} catch (e: unknown) {
		// Fall back to multipart if presign returns 501 (R2 not configured) or fails
		if (e instanceof Error && e.message.includes('501')) {
			return uploadViaMultipart(slug, files);
		}
		throw e;
	}
}

async function uploadViaPresign(slug: string, files: FileList): Promise<CreateSourceResponse[]> {
	const filesMeta = Array.from(files).map(f => ({
		filename: f.name,
		content_type: f.type || 'application/octet-stream'
	}));

	const presignRes = await authedFetch(`/models/${slug}/sources/upload/presign`, {
		method: 'POST',
		body: JSON.stringify({ files: filesMeta })
	});
	const presign: PresignResponse = await presignRes.json();

	// Upload each file directly to R2
	await Promise.all(presign.files.map(async (pf) => {
		const file = Array.from(files).find(f => f.name === pf.filename);
		if (!file) throw new Error(`File not found: ${pf.filename}`);
		const uploadRes = await fetch(pf.upload_url, {
			method: 'PUT',
			headers: { 'Content-Type': pf.content_type },
			body: file
		});
		if (!uploadRes.ok) throw new Error(`R2 upload failed for ${pf.filename} (${uploadRes.status})`);
	}));

	// Confirm uploads
	const confirmRes = await authedFetch(`/models/${slug}/sources/upload/confirm`, {
		method: 'POST',
		body: JSON.stringify({
			upload_id: presign.upload_id,
			files: presign.files.map(pf => ({ filename: pf.filename, object_key: pf.object_key }))
		})
	});
	return confirmRes.json();
}

async function uploadViaMultipart(slug: string, files: FileList): Promise<CreateSourceResponse[]> {
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
