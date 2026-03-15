import { env } from '$env/dynamic/public';
import type { RagModel, RagModelCreate, RagModelUpdate, WidgetTheme, StatsResponse, DailyStatsEntry, TopSourceEntry, ConversationListResponse, ConversationDetailResponse, SourceListResponse, CreateSourceRequest, CreateSourceResponse, PresignResponse, ChunkListResponse, ChunkDetail, ApiKeyRead, ApiKeyCreateResponse, SystemPromptHistoryEntry } from './admin-types';

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

export async function getDailyStats(slug: string, days = 30): Promise<DailyStatsEntry[]> {
	const res = await authedFetch(`/models/${slug}/stats/daily?days=${days}`);
	return res.json();
}

export async function getTopSources(slug: string, limit = 10): Promise<TopSourceEntry[]> {
	const res = await authedFetch(`/models/${slug}/stats/top-sources?limit=${limit}`);
	return res.json();
}

// Conversations
export async function getConversations(slug: string, limit = 50, offset = 0): Promise<ConversationListResponse> {
	const res = await authedFetch(`/models/${slug}/conversations?limit=${limit}&offset=${offset}`);
	return res.json();
}

export async function deleteConversation(slug: string, conversationId: number): Promise<void> {
	await authedFetch(`/models/${slug}/conversations/${conversationId}`, { method: 'DELETE' });
}

export async function getConversationMessages(slug: string, conversationId: number): Promise<ConversationDetailResponse> {
	const res = await authedFetch(`/models/${slug}/conversations/${conversationId}/messages`);
	return res.json();
}

// Crawl
export async function crawlSite(slug: string, url: string, maxPages = 50, maxDepth = 3): Promise<{ status: string; message: string; pages_queued: number }> {
	const res = await authedFetch(`/models/${slug}/sources/crawl`, {
		method: 'POST',
		body: JSON.stringify({ url, max_pages: maxPages, max_depth: maxDepth }),
	});
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

// System Prompt
export async function getSystemPromptHistory(slug: string): Promise<SystemPromptHistoryEntry[]> {
	const res = await authedFetch(`/models/${slug}/system-prompt-history`);
	return res.json();
}

export async function rollbackSystemPrompt(slug: string, historyId: number): Promise<SystemPromptHistoryEntry> {
	const res = await authedFetch(`/models/${slug}/system-prompt-history/${historyId}/rollback`, { method: 'POST' });
	return res.json();
}

export async function streamGenerateSystemPrompt(
	slug: string,
	inputText: string,
	onToken: (text: string) => void,
	onDone: () => void,
	onError: (err: string) => void
): Promise<void> {
	const auth = await getAuthHeader();
	const res = await fetch(`${baseUrl()}/models/${slug}/generate-system-prompt`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			authorization: auth,
		},
		body: JSON.stringify({ input_text: inputText }),
	});
	if (!res.ok) {
		const body = await res.text();
		onError(`${res.status}: ${body}`);
		return;
	}
	const reader = res.body?.getReader();
	if (!reader) { onError('No response body'); return; }
	const decoder = new TextDecoder();
	let buffer = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';
		for (const line of lines) {
			if (line.startsWith('event: done')) {
				onDone();
				return;
			}
			if (line.startsWith('event: error')) {
				continue; // next line has the data
			}
			if (line.startsWith('data: ')) {
				const payload = line.slice(6);
				try {
					const parsed = JSON.parse(payload);
					if (typeof parsed === 'string') {
						onToken(parsed);
					} else if (parsed.error) {
						onError(parsed.error);
						return;
					}
				} catch { /* skip malformed */ }
			}
		}
	}
	onDone();
}

export async function acceptGeneratedPrompt(
	slug: string,
	promptText: string,
	inputText: string
): Promise<SystemPromptHistoryEntry> {
	const res = await authedFetch(`/models/${slug}/system-prompt-history/accept-generated`, {
		method: 'POST',
		body: JSON.stringify({ prompt_text: promptText, input_text: inputText }),
	});
	return res.json();
}
