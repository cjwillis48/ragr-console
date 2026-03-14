export interface WidgetTheme {
	label?: string | null;
	greeting?: string | null;
	placeholder?: string | null;
	launcher_hint?: string | null;
	primary_color?: string | null;
	bg_color?: string | null;
	text_color?: string | null;
	user_bubble_color?: string | null;
	bot_bubble_color?: string | null;
	font_family?: string | null;
	border_radius?: number | null;
}

export interface RagModel {
	id: number;
	name: string;
	slug: string;
	description: string;
	system_prompt: string;
	chunk_size: number;
	chunk_overlap: number;
	similarity_threshold: number;
	top_k: number;
	embedding_model: string;
	generation_model: string;
	reranker_enabled: boolean;
	rerank_model: string;
	allowed_origins: string[];
	hosted_chat: boolean;
	history_turns: number;
	budget_limit: number;
	is_active: boolean;
	has_custom_anthropic_key: boolean;
	has_custom_voyage_key: boolean;
	created_at: string;
	updated_at: string;
}

export interface RagModelCreate {
	name: string;
	slug: string;
	description?: string;
	system_prompt?: string;
	chunk_size?: number | null;
	chunk_overlap?: number | null;
	similarity_threshold?: number | null;
	top_k?: number | null;
	embedding_model?: string | null;
	generation_model?: string | null;
	reranker_enabled?: boolean | null;
	rerank_model?: string | null;
	allowed_origins?: string[] | null;
	hosted_chat?: boolean | null;
	history_turns?: number | null;
	budget_limit?: number | null;
}

export interface RagModelUpdate {
	name?: string | null;
	description?: string | null;
	system_prompt?: string | null;
	chunk_size?: number | null;
	chunk_overlap?: number | null;
	similarity_threshold?: number | null;
	top_k?: number | null;
	embedding_model?: string | null;
	generation_model?: string | null;
	reranker_enabled?: boolean | null;
	rerank_model?: string | null;
	allowed_origins?: string[] | null;
	hosted_chat?: boolean | null;
	history_turns?: number | null;
	budget_limit?: number | null;
	is_active?: boolean | null;
	anthropic_api_key?: string | null;
	voyage_api_key?: string | null;
}

export interface StatsResponse {
	model_slug: string;
	total_chunks: number;
	total_conversations: number;
	total_messages: number;
	unanswered_questions: number;
	current_month_cost: number;
	budget_limit: number;
	budget_remaining: number;
	total_sources: number;
}

export interface RetrievedChunkRef {
	chunk_id: number;
	distance: number;
	rerank_score: number | null;
	keyword_rank: number | null;
	retrieval_method: string | null;
}

export function chunkRetrievalMethod(ref: RetrievedChunkRef): string {
	if (ref.retrieval_method) return ref.retrieval_method;
	// Fallback for data written before the backfill migration
	const hasVector = ref.distance < 1.0;
	const hasKeyword = ref.keyword_rank != null;
	if (hasVector && hasKeyword) return 'hybrid';
	if (hasKeyword) return 'keyword';
	return 'vector';
}

export function sortChunkRefs(refs: RetrievedChunkRef[]): RetrievedChunkRef[] {
	return [...refs].sort((a, b) => {
		// If rerank scores exist, sort by rerank descending
		if (a.rerank_score != null && b.rerank_score != null) return b.rerank_score - a.rerank_score;
		if (a.rerank_score != null) return -1;
		if (b.rerank_score != null) return 1;
		// Otherwise sort by distance ascending (lower = more similar)
		return a.distance - b.distance;
	});
}

export interface MessageResponse {
	id: number;
	question: string;
	answer: string;
	status: string;
	tokens_in: number;
	tokens_out: number;
	retrieved_chunks: RetrievedChunkRef[];
	created_at: string;
}

export interface ConversationSummaryResponse {
	id: number;
	session_id: string;
	title: string | null;
	message_count: number;
	created_at: string;
	updated_at: string;
}

export interface ConversationDetailResponse {
	id: number;
	session_id: string;
	title: string | null;
	messages: MessageResponse[];
	message_count: number;
	created_at: string;
	updated_at: string;
}

export interface ChunkDetail {
	id: number;
	content: string;
	source_identifier: string;
	content_type: string;
}

export interface ConversationListResponse {
	model_slug: string;
	conversations: ConversationSummaryResponse[];
	total: number;
	limit: number;
	offset: number;
}

export interface SourceResponse {
	id: number;
	source_identifier: string;
	source_url: string;
	content_type: string;
	status: string;
	chunk_count: number;
	embedding_cost: number;
	ingested_at: string;
	updated_at: string;
}

export interface SourceListResponse {
	model_slug: string;
	sources: SourceResponse[];
	total: number;
}

export interface CreateSourceRequest {
	source_identifier?: string | null;
	content?: string | null;
	url?: string | null;
	urls?: string[] | null;
	content_type?: string;
	source_url?: string;
}

export interface CreateSourceResponse {
	source_identifier: string;
	status: string;
	chunks_created: number | null;
	skipped: boolean;
	message: string;
}

export interface PresignFileRequest {
	filename: string;
	content_type: string;
}

export interface PresignFileResponse {
	filename: string;
	object_key: string;
	upload_url: string;
	content_type: string;
}

export interface PresignResponse {
	upload_id: string;
	files: PresignFileResponse[];
}

export interface ConfirmFileRequest {
	filename: string;
	object_key: string;
}

export interface ChunkResponse {
	id: number;
	content: string;
	source_url: string;
	content_type: string;
	ingested_at: string;
}

export interface ChunkListResponse {
	source_identifier: string;
	chunks: ChunkResponse[];
	total: number;
}

export interface ApiKeyRead {
	id: number;
	label: string;
	key_prefix: string;
	is_active: boolean;
	created_at: string;
	last_used_at: string | null;
}

export interface ApiKeyCreateResponse {
	id: number;
	label: string;
	key_prefix: string;
	raw_key: string;
	created_at: string;
}