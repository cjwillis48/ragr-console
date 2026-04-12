import { defineConfig, devices } from '@playwright/test';

// Playwright runs the test suite against the production build served via
// `vite preview`. The widget bundle must be rebuilt as part of the build,
// which npm run build takes care of (build:widget runs before vite build).
//
// CI note: run `npx playwright install --with-deps chromium` once before
// the first test run. Set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 in the
// Cloudflare Pages build env to avoid the ~200 MB chromium download during
// static deploys.
export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI ? 'github' : 'list',
	timeout: 30_000,
	expect: { timeout: 5_000 },
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	webServer: {
		command: 'npm run build && npm run preview',
		url: 'http://localhost:4173',
		timeout: 180_000,
		reuseExistingServer: !process.env.CI,
		stdout: 'pipe',
		stderr: 'pipe'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'mobile',
			use: { ...devices['iPhone 14'] }
		}
	]
});
