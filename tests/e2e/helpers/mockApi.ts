// Playwright helpers for the widget test suite.
//
// The widget bundle bakes PUBLIC_RAGR_API_URL at build time (see
// vite.widget.config.ts). Locally that defaults to http://localhost:8000,
// which isn't running during tests — so every test must intercept
// /models/{slug}/* requests and serve fixture responses.
import type { Page, Route } from '@playwright/test';
import modelInfoFixture from '../fixtures/modelInfo.json' with { type: 'json' };
import themeFixture from '../fixtures/theme.json' with { type: 'json' };

export interface MockApiOptions {
	modelInfo?: object;
	theme?: object;
	// Overrides for the /chat endpoint. If provided, the chat route serves
	// this SSE body verbatim. Otherwise it serves a simple one-delta + done
	// stream ending in "answered".
	chatSSE?: string;
	// If true, /chat returns HTTP 500 instead of a stream.
	chatError?: boolean;
	// Delay applied to the chat response headers to simulate slow starts.
	chatDelayMs?: number;
}

const DEFAULT_CHAT_SSE =
	'data: "Hello "\n\n' +
	'data: "from the "\n\n' +
	'data: "fixture stream."\n\n' +
	'event: done\ndata: {"answer":"Hello from the fixture stream.","status":"answered"}\n\n';

export async function mockRagrApi(page: Page, options: MockApiOptions = {}): Promise<void> {
	const info = options.modelInfo ?? modelInfoFixture;
	const theme = options.theme ?? themeFixture;
	const chatSSE = options.chatSSE ?? DEFAULT_CHAT_SSE;

	await page.route('**/models/*/info', async (route: Route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(info)
		});
	});

	await page.route('**/models/*/theme', async (route: Route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(theme)
		});
	});

	await page.route('**/models/*/chat', async (route: Route) => {
		if (options.chatDelayMs) {
			await new Promise((r) => setTimeout(r, options.chatDelayMs));
		}
		if (options.chatError) {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'mocked server error' })
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'text/event-stream',
			headers: {
				'cache-control': 'no-cache',
				connection: 'keep-alive'
			},
			body: chatSSE
		});
	});
}
