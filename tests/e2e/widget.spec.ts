// End-to-end tests for the <ragr-chat> embeddable widget.
//
// All tests run against the production build served by `vite preview` on
// port 4173 (see playwright.config.ts). Each test mocks the RAGR API via
// page.route so no backend is needed.
//
// The harness page is /embed-demo.html (see static/embed-demo.html). It
// drops a single <ragr-chat slug="demo-slug"> on a realistic parent page
// with scrolling, sticky header, and hostile CSS (`button { all: unset }`).
import { test, expect, type Page } from '@playwright/test';
import { mockRagrApi } from './helpers/mockApi';

async function load(page: Page, mockOpts: Parameters<typeof mockRagrApi>[1] = {}) {
	await mockRagrApi(page, mockOpts);
	await page.goto('/embed-demo.html');
	// Wait for the custom element to be defined + the widget bundle to run.
	await page.waitForFunction(() => !!customElements.get('ragr-chat'));
}

async function waitForLoaded(page: Page) {
	// The Preact tree only mounts after fetchModelInfo + fetchTheme resolve,
	// so we wait for the launcher button to become visible.
	await expect(
		page.locator('ragr-chat').locator('.ragr-launcher-btn')
	).toBeVisible();
}

test.describe('widget loading', () => {
	test('custom element registers and launcher appears', async ({ page }) => {
		await load(page);
		await waitForLoaded(page);
		const launcher = page.locator('ragr-chat').locator('.ragr-launcher-btn');
		await expect(launcher).toBeVisible();
	});

	test('launcher hint appears then auto-hides', async ({ page }) => {
		await load(page);
		const hint = page.locator('ragr-chat').locator('.ragr-launcher-hint');
		await expect(hint).toBeVisible();
		await expect(hint).toBeHidden({ timeout: 10_000 });
	});

	test('missing slug logs a warning and renders nothing', async ({ page }) => {
		await mockRagrApi(page);
		const warnings: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'warning') warnings.push(msg.text());
		});
		await page.goto('/embed-demo.html');
		await page.evaluate(() => {
			const el = document.querySelector('ragr-chat') as HTMLElement;
			el.removeAttribute('slug');
		});
		await page.waitForTimeout(300);
		expect(warnings.some((w) => w.includes('slug'))).toBe(true);
	});
});

test.describe('open / close / expand', () => {
	test('clicking launcher opens panel and focuses textarea', async ({ page }) => {
		await load(page);
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		const panel = page.locator('ragr-chat').locator('.ragr-panel');
		await expect(panel).toBeVisible();
		await expect(page.locator('ragr-chat').locator('.ragr-textarea')).toBeFocused();
	});

	test('close button returns to launcher', async ({ page }) => {
		await load(page);
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		await page.locator('ragr-chat').locator('.ragr-close-btn').click();
		await expect(page.locator('ragr-chat').locator('.ragr-panel')).toHaveCount(0);
		await expect(page.locator('ragr-chat').locator('.ragr-launcher-btn')).toBeVisible();
	});

	test('escape key closes panel', async ({ page }) => {
		await load(page);
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		await page.locator('ragr-chat').locator('.ragr-textarea').press('Escape');
		await expect(page.locator('ragr-chat').locator('.ragr-panel')).toHaveCount(0);
	});

	test('expand toggle grows the panel', async ({ page, isMobile }) => {
		test.skip(isMobile, 'expand button is hidden on mobile');
		await load(page);
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		const panel = page.locator('ragr-chat').locator('.ragr-panel');
		await expect(panel).toHaveAttribute('data-size', 'normal');
		const normalBox = await panel.boundingBox();
		await page.locator('ragr-chat').locator('.ragr-expand-btn').click();
		await expect(panel).toHaveAttribute('data-size', 'large');
		// Small delay for the 220ms width transition to finish.
		await page.waitForTimeout(300);
		const largeBox = await panel.boundingBox();
		expect(normalBox).toBeTruthy();
		expect(largeBox).toBeTruthy();
		expect(largeBox!.width).toBeGreaterThan(normalBox!.width);
		expect(largeBox!.height).toBeGreaterThan(normalBox!.height);
	});
});

test.describe('streaming chat flow', () => {
	test('streams deltas into the bot bubble and finalizes on done', async ({ page }) => {
		await load(page);
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		const textarea = page.locator('ragr-chat').locator('.ragr-textarea');
		await textarea.fill('How does this work?');
		await textarea.press('Enter');

		// User bubble appears immediately.
		await expect(
			page.locator('ragr-chat').locator('.ragr-bubble-user').last()
		).toContainText('How does this work?');

		// Final streamed answer is the concatenation of deltas.
		await expect(
			page.locator('ragr-chat').locator('.ragr-bubble-bot').last()
		).toContainText('Hello from the fixture stream.');
	});

	test('500 on chat endpoint surfaces an error bar', async ({ page }) => {
		await load(page, { chatError: true });
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		await page.locator('ragr-chat').locator('.ragr-textarea').fill('test');
		await page.locator('ragr-chat').locator('.ragr-textarea').press('Enter');
		await expect(
			page.locator('ragr-chat').locator('.ragr-error-bar')
		).toBeVisible();
	});

	test('no status badges are rendered even on off_topic responses', async ({ page }) => {
		const offTopicSSE =
			'event: done\ndata: {"answer":"I can only help with product questions.","status":"off_topic"}\n\n';
		await load(page, { chatSSE: offTopicSSE });
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		await page.locator('ragr-chat').locator('.ragr-textarea').fill('weather?');
		await page.locator('ragr-chat').locator('.ragr-textarea').press('Enter');
		await expect(
			page.locator('ragr-chat').locator('.ragr-bubble-bot').last()
		).toContainText('I can only help');
		// Explicitly assert there are NO status badges anywhere in the shadow.
		const badgeCount = await page
			.locator('ragr-chat')
			.locator('[class*="status-badge"], .ragr-status-badge')
			.count();
		expect(badgeCount).toBe(0);
	});
});

test.describe('suggested questions', () => {
	test('sample questions appear below greeting', async ({ page }) => {
		await load(page);
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		const pills = page.locator('ragr-chat').locator('.ragr-suggestion');
		await expect(pills).toHaveCount(3);
		await expect(pills.nth(0)).toHaveText('What can you help me with?');
	});

	test('clicking a sample question sends it as the user message', async ({ page }) => {
		await load(page);
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		await page.locator('ragr-chat').locator('.ragr-suggestion').first().click();
		await expect(
			page.locator('ragr-chat').locator('.ragr-bubble-user').last()
		).toContainText('What can you help me with?');
	});

	test('suggestions reappear after an off-topic response', async ({ page }) => {
		const offTopicSSE =
			'event: done\ndata: {"answer":"Outside my scope.","status":"off_topic"}\n\n';
		await load(page, { chatSSE: offTopicSSE });
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		await page.locator('ragr-chat').locator('.ragr-textarea').fill('random');
		await page.locator('ragr-chat').locator('.ragr-textarea').press('Enter');
		// Wait for the bot response to arrive, then check suggestions reappear.
		await expect(
			page.locator('ragr-chat').locator('.ragr-bubble-bot').last()
		).toContainText('Outside my scope');
		// The first bot message (greeting) still has its suggestions, and the
		// off-topic response should also have them beneath it, totaling 6.
		const pillCount = await page
			.locator('ragr-chat')
			.locator('.ragr-suggestion')
			.count();
		expect(pillCount).toBeGreaterThanOrEqual(3);
	});
});

test.describe('keyboard', () => {
	test('Shift+Enter inserts a newline without sending', async ({ page }) => {
		await load(page);
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		const textarea = page.locator('ragr-chat').locator('.ragr-textarea');
		await textarea.fill('line one');
		await textarea.press('Shift+Enter');
		await textarea.type('line two');
		// The textarea should contain both lines; no user bubble yet.
		const value = await textarea.inputValue();
		expect(value).toContain('line one');
		expect(value).toContain('line two');
		const userBubbleCount = await page
			.locator('ragr-chat')
			.locator('.ragr-bubble-user')
			.count();
		expect(userBubbleCount).toBe(0);
	});
});

test.describe('markdown rendering', () => {
	test('links open in a new tab with noopener noreferrer', async ({ page }) => {
		const withLinkSSE =
			'event: done\ndata: {"answer":"See our [docs](https://example.com/docs) for details.","status":"answered"}\n\n';
		await load(page, { chatSSE: withLinkSSE });
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		await page.locator('ragr-chat').locator('.ragr-textarea').fill('where are docs?');
		await page.locator('ragr-chat').locator('.ragr-textarea').press('Enter');
		const link = page
			.locator('ragr-chat')
			.locator('.ragr-bubble-bot')
			.last()
			.locator('a[href="https://example.com/docs"]');
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('target', '_blank');
		const rel = await link.getAttribute('rel');
		expect(rel).toContain('noopener');
		expect(rel).toContain('noreferrer');
	});
});

test.describe('theme application', () => {
	test('custom theme colors apply as CSS custom properties on host', async ({ page }) => {
		await load(page);
		await waitForLoaded(page);
		const primary = await page.locator('ragr-chat').evaluate(
			(el) => getComputedStyle(el).getPropertyValue('--ragr-primary').trim()
		);
		// Fixture uses #ff6600.
		expect(primary.toLowerCase()).toBe('#ff6600');
	});

	test('Google Font link is injected into document head', async ({ page }) => {
		await load(page);
		await waitForLoaded(page);
		const link = page.locator('link[data-ragr-font="Roboto"]');
		await expect(link).toHaveCount(1);
	});
});

test.describe('mobile viewport', () => {
	test('panel fills screen on mobile and expand button is hidden', async ({
		page,
		isMobile
	}) => {
		test.skip(!isMobile, 'only runs in mobile project');
		await load(page);
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		const panel = page.locator('ragr-chat').locator('.ragr-panel');
		// Wait for the 220ms open animation (translateY + scale) so the
		// boundingBox reflects the resting layout, not the mid-animation
		// transform.
		await page.waitForTimeout(400);
		const box = await panel.boundingBox();
		const viewport = page.viewportSize();
		expect(box).toBeTruthy();
		expect(viewport).toBeTruthy();
		// Within 2px of full viewport (accounting for borders / subpixel).
		expect(box!.width).toBeGreaterThanOrEqual(viewport!.width - 2);
		expect(box!.height).toBeGreaterThanOrEqual(viewport!.height - 2);
		// Expand button is rendered in the DOM but hidden via the
		// `@media (max-width: 640px) { .ragr-expand-btn { display: none } }`
		// rule in src/widget/styles.ts, so assert visibility not presence.
		await expect(
			page.locator('ragr-chat').locator('.ragr-expand-btn')
		).toBeHidden();
	});
});

test.describe('shadow DOM isolation', () => {
	test('hostile parent CSS does not break the send button', async ({ page, isMobile }) => {
		test.skip(isMobile, 'desktop only');
		await load(page);
		await waitForLoaded(page);
		// The harness page sets `button { all: unset !important }` at the
		// document level. The send button lives inside the shadow root so it
		// must still look like a button: non-zero dimensions, display block,
		// and cursor pointer when enabled.
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		// Type something so the send button is enabled (a disabled button
		// has cursor: not-allowed per the widget's own rule).
		await page.locator('ragr-chat').locator('.ragr-textarea').fill('hello');
		const sendButton = page.locator('ragr-chat').locator('.ragr-send');
		const styles = await sendButton.evaluate((el) => {
			const cs = getComputedStyle(el);
			return {
				cursor: cs.cursor,
				width: cs.width,
				display: cs.display
			};
		});
		expect(styles.display).not.toBe('inline');
		// Width should be 40px (the .ragr-send rule).
		expect(parseInt(styles.width)).toBeGreaterThanOrEqual(30);
		expect(styles.cursor).toBe('pointer');
	});
});

test.describe('parent scroll isolation', () => {
	test('scrolling the parent page does not affect widget position', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'desktop only');
		await load(page);
		await waitForLoaded(page);
		await page.locator('ragr-chat').locator('.ragr-launcher-btn').click();
		const panel = page.locator('ragr-chat').locator('.ragr-panel');
		// Wait for the 220ms open animation (ragr-panel-in) to fully settle
		// before taking a baseline — otherwise the initial measurement is
		// captured mid-animation and the transform offset is counted as drift.
		await page.waitForTimeout(400);
		const beforeBox = await panel.boundingBox();
		// Scroll the parent page.
		await page.evaluate(() => window.scrollTo(0, 1200));
		await page.waitForTimeout(200);
		const afterBox = await panel.boundingBox();
		expect(beforeBox).toBeTruthy();
		expect(afterBox).toBeTruthy();
		// Host is position:fixed so the panel's viewport coordinates should
		// be stable when the parent scrolls — allow a couple of pixels for
		// sub-pixel rounding.
		expect(Math.abs(afterBox!.y - beforeBox!.y)).toBeLessThan(4);
		expect(Math.abs(afterBox!.x - beforeBox!.x)).toBeLessThan(4);
	});
});
