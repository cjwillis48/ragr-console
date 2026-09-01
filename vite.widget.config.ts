import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Dedicated build for the embeddable widget bundle. Kept separate from
// vite.config.ts because the `sveltekit()` plugin assumes control of the
// rollup inputs — sharing one config fights the SvelteKit build graph.
//
// Output: static/widget/ragr-chat.js — a single self-executing IIFE that
// registers the <ragr-chat> custom element. Cloudflare Pages serves the
// static/ directory verbatim, so the file becomes available at
// /widget/ragr-chat.js once `npm run build` has run.
//
// PUBLIC_RAGR_API_URL is inlined at build time (one URL per deploy env).
// The loader script can override it per-instance via the `api-base`
// attribute on <ragr-chat> if a customer ever needs it.
export default defineConfig({
	define: {
		'import.meta.env.PUBLIC_RAGR_API_URL': JSON.stringify(
			process.env.PUBLIC_RAGR_API_URL || 'http://localhost:8000'
		),
		'import.meta.env.WIDGET_VERSION': JSON.stringify(process.env.WIDGET_VERSION || 'dev')
	},
	build: {
		lib: {
			entry: resolve(import.meta.dirname, 'src/widget/index.ts'),
			name: 'RagrChat',
			formats: ['iife'],
			fileName: () => 'ragr-chat.js'
		},
		outDir: 'static/widget',
		emptyOutDir: false,
		sourcemap: true,
		minify: 'esbuild',
		target: 'es2020',
		cssCodeSplit: false,
		rollupOptions: {
			output: {
				inlineDynamicImports: true,
				// Suppress the IIFE global name warning — we don't need the global
				extend: false
			}
		}
	},
	esbuild: {
		// htm tagged templates need JSX-free handling. Preact works as plain TS.
		legalComments: 'none'
	}
});
