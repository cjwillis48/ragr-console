# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SvelteKit admin console + public chat UI for RAGR, plus an embeddable chat widget
shipped as a standalone bundle. The backend is a separate FastAPI service reached
over HTTP at `PUBLIC_RAGR_API_URL` — this repo contains no server-side business
logic beyond SvelteKit `+server.ts` endpoints.

## Commands

```sh
npm run dev          # dev server (widget bundle NOT rebuilt — see below)
npm run check        # svelte-check typecheck
npm run build        # build:widget THEN vite build — order matters
npm run test:e2e     # Playwright; runs a full prod build first (~3 min)
npm run build:widget # widget bundle only
npm run dev:widget   # widget bundle in watch mode
```

After any change, run `npm run check` and `npm run build`. Both must pass before
the work is done. `npm run build` is not optional — it is the only thing that
catches widget-bundle breakage, since the widget has its own Vite config that
`vite dev` never touches.

Node comes from `.nvmrc` (`lts/*`) and `.npmrc` sets `engine-strict=true`. If npm
fails on an engine mismatch: `source ~/.nvm/nvm.sh && nvm use --lts`.

## The two API layers — do not add a third

- `src/lib/api.ts` — **public, unauthenticated.** Every function takes an explicit
  `ApiConfig { baseUrl }` rather than reading env, because the widget runs on
  customer sites and injects its own base URL. Keep it env-free.
- `src/lib/admin-api.ts` — **Clerk-authenticated.** Reads `PUBLIC_RAGR_API_URL`
  from `$env/dynamic/public` and attaches a bearer token via the getter installed
  by `setTokenGetter()`. Calling it before that getter is set throws
  `'Auth not initialized'`.

Never `fetch()` the backend directly from a component — go through these. The
backend is FastAPI: wire fields are `snake_case`, and errors come back as
`{ detail: string | Array<{msg}> }`, which `admin-api.ts` already unwraps.

## The embeddable widget (`src/widget/`)

Preact + `htm` (no JSX, no build-time JSX transform), rendered into a **shadow
root**, published as a single IIFE at `static/widget/ragr-chat.js`.

- Built by `vite.widget.config.ts`, deliberately separate from `vite.config.ts` —
  the `sveltekit()` plugin owns the rollup inputs and fighting it breaks the build.
- `PUBLIC_RAGR_API_URL` is **inlined at build time**, not read at runtime. Changing
  it requires rebuilding the bundle, and any test must intercept requests rather
  than repoint the URL.
- Styles live in `src/widget/styles.ts` as a CSS string injected into the shadow
  root. The widget uses **no Tailwind** — do not reach for utility classes there.
- `static/widget/` is gitignored build output. Never commit it, and never hand-edit it.
- `scripts/build-widget.mjs` stamps `WIDGET_VERSION` from the short git sha and
  emits a hashed `ragr-chat.<sha>.js` alongside the unversioned file. Caching for
  both is declared in `_headers` (Cloudflare Pages).

## Conventions

- **Svelte 5 runes only.** `$state` / `$props` / `$derived` / `$effect`. There is no
  `export let` or `$:` anywhere — don't introduce any. Cross-file reactive state
  goes in `.svelte.ts` modules (see `src/lib/toast.svelte.ts`,
  `src/lib/current-user.svelte.ts`).
- Event attributes use the Svelte 5 form: `onclick={...}`, not `on:click`.
- Import `page` from `$app/state`, not the deprecated `$app/stores`.
- **Tailwind v4, CSS-first.** There is no `tailwind.config.js` and no PostCSS config.
  Design tokens live in the `@theme` block of `src/app.css` and generate the
  `surface` / `border` / `text-muted` / `accent` classes used across admin. Add new
  tokens there rather than hardcoding hex values in markup.
- Style is tabs, single quotes, semicolons — enforced by Prettier (`npm run format`).
- `checkJs` is on, so `.js` files are typechecked too.

## Auth and errors

`src/hooks.server.ts` is the whole auth chain: `withClerkHandler()` plus a
`handleError` that ships errors to Axiom. Axiom is a silent no-op unless both
`AXIOM_TOKEN` and `AXIOM_DATASET` are set, so missing logs locally are expected.

Embed-origin enforcement lives on the **backend** as CORS on `/models/{slug}/*`. A
`frame-ancestors` CSP handler used to be here and was removed on purpose — don't
re-add CSP logic expecting it to gate embeds.

## Environment

No `.env.example` exists yet; required vars are `PUBLIC_RAGR_API_URL`,
`PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, the four
`PUBLIC_CLERK_{SIGN_IN,SIGN_UP,AFTER_SIGN_IN,AFTER_SIGN_UP}_URL` values,
`PUBLIC_DEMO_SLUGS`, and optionally `AXIOM_TOKEN` / `AXIOM_DATASET`.
`PUBLIC_WIDGET_SHA` is set only at deploy time to pin customers to an immutable
hashed bundle; empty locally is normal.

Local admin work needs the backend API running at `PUBLIC_RAGR_API_URL`.

## Testing

Playwright only — no unit-test runner. The single spec `tests/e2e/widget.spec.ts`
covers the widget exclusively (admin, auth, and SvelteKit routes are untested).
Because the API URL is baked into the bundle, tests mock via `page.route()`
interception (`tests/e2e/helpers/mockApi.ts`). The harness page
`static/embed-demo.html` applies hostile CSS on purpose to prove shadow isolation —
that is the test working, not a bug.

## Git

Work on a feature branch (`feat/...`) and open a PR; don't commit directly to `main`.
Commit subjects are plain sentence-case imperative — no `feat:`/`fix:` prefixes.

CI is Cloudflare Pages' Git integration, not GitHub Actions — there is no
`.github/workflows/`. Pages builds on push, so a broken `npm run build` fails the
deploy, and merging to `main` ships. That gate covers the build only: run
`npm run check` locally, because a type error that doesn't break the build will
reach production unnoticed.

## Known rough edges

- `src/routes/admin/[slug]/+page.svelte` is ~2000 lines (a third of the codebase) —
  the whole model editor in one file. Read it carefully before editing; ask before
  restructuring it.
- `.claude/SECURITY_FINDINGS.md` (local-only) tracks open items, notably no
  Subresource Integrity on the injected widget bundle.
