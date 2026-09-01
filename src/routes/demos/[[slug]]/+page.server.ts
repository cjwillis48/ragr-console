import { env } from '$env/dynamic/public';
import type { PageServerLoad } from './$types';

interface DemoModel {
	name: string;
	slug: string;
	description: string;
	accepting_requests: boolean;
}

export const load: PageServerLoad = async ({ params }) => {
	const slugs = (env.PUBLIC_DEMO_SLUGS || '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

	// Fetch model info for each configured slug using the public widget
	// endpoint (no auth required — same endpoint the chat widget uses).
	const results = await Promise.all(
		slugs.map(async (slug): Promise<DemoModel | null> => {
			try {
				const res = await fetch(`${env.PUBLIC_RAGR_API_URL}/models/${slug}/info`);
				if (!res.ok) return null;
				return await res.json();
			} catch {
				return null;
			}
		})
	);

	const models = results.filter((m): m is DemoModel => m !== null && m.accepting_requests);

	return {
		models,
		selectedSlug: params.slug || models[0]?.slug || null
	};
};
