import { env } from '$env/dynamic/public';
import { logWarn } from '$lib/axiom';
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
	// This is the one server-side call to the RAGR API in the app. A demo that
	// silently vanishes from the page used to leave no trace anywhere, so both
	// failure modes are recorded before being swallowed.
	const results = await Promise.all(
		slugs.map(async (slug): Promise<DemoModel | null> => {
			const path = `/models/${slug}/info`;
			try {
				const res = await fetch(`${env.PUBLIC_RAGR_API_URL}${path}`);
				if (!res.ok) {
					await logWarn(`Demo model info failed (${res.status})`, {
						source: 'server',
						event: 'demo_info_failure',
						api_path: path,
						status: res.status
					});
					return null;
				}
				return await res.json();
			} catch (e) {
				await logWarn(e instanceof Error ? e.message : String(e), {
					source: 'server',
					event: 'demo_info_unreachable',
					api_path: path
				});
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
