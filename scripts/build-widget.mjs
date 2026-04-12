#!/usr/bin/env node
// Build wrapper for the widget bundle. Computes WIDGET_VERSION from git
// (short sha) and threads it through both the vite build (for the
// `import.meta.env.WIDGET_VERSION` define) and the post-build hash script
// (for naming ragr-chat.<sha>.js). Falls back to "dev" if git is unavailable
// or the repo has no commits.
//
// Using a Node wrapper instead of an inline shell expression because
// `FOO=$(...) cmd1 && cmd2` only scopes the env var to cmd1 in POSIX shells,
// and cross-platform JSON quoting for an inline `sh -c ...` is a nightmare.
import { execSync, spawnSync } from 'node:child_process';

let version = process.env.WIDGET_VERSION || '';
if (!version) {
	try {
		version = execSync('git rev-parse --short HEAD', {
			stdio: ['ignore', 'pipe', 'ignore']
		}).toString().trim();
	} catch {
		version = 'dev';
	}
}

const env = { ...process.env, WIDGET_VERSION: version };
const log = (msg) => console.log(`[build-widget] ${msg}`);
log(`WIDGET_VERSION=${version}`);

function run(cmd, args) {
	const result = spawnSync(cmd, args, { stdio: 'inherit', env });
	if (result.status !== 0) {
		log(`command failed: ${cmd} ${args.join(' ')}`);
		process.exit(result.status ?? 1);
	}
}

run('npx', ['vite', 'build', '--config', 'vite.widget.config.ts']);
run('node', ['scripts/hash-widget.mjs']);
