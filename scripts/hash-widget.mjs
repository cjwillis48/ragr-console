#!/usr/bin/env node
// After building the widget bundle, copy static/widget/ragr-chat.js to
// static/widget/ragr-chat.<sha>.js so the loader can pin customers to an
// immutable versioned URL. The unversioned file stays in place as a fallback
// and for local dev convenience.
//
// WIDGET_VERSION is typically set to `git rev-parse --short HEAD` by the
// build:widget script. If missing we skip the copy — the unversioned file
// is still valid, just not cacheable long-term.
import { cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const widgetDir = join(__dirname, '..', 'static', 'widget');
const src = join(widgetDir, 'ragr-chat.js');
const mapSrc = join(widgetDir, 'ragr-chat.js.map');

const version = process.env.WIDGET_VERSION;
if (!version || version === 'dev') {
	console.log('[hash-widget] WIDGET_VERSION not set (or is "dev"), skipping hashed copy.');
	process.exit(0);
}

if (!existsSync(src)) {
	console.error(`[hash-widget] ${src} not found; did the widget build run?`);
	process.exit(1);
}

const dst = join(widgetDir, `ragr-chat.${version}.js`);
cpSync(src, dst);
console.log(`[hash-widget] copied → ${dst}`);

if (existsSync(mapSrc)) {
	const mapDst = join(widgetDir, `ragr-chat.${version}.js.map`);
	cpSync(mapSrc, mapDst);
	console.log(`[hash-widget] copied → ${mapDst}`);
}
