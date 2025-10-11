#!/usr/bin/env node
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const commanderBundle = join(process.cwd(), 'node_modules', 'next', 'dist', 'compiled', 'commander', 'index.js');

if (!existsSync(commanderBundle)) {
  console.error('\n[setup] Dependencies for Next.js are missing.');
  console.error('[setup] Run "pnpm install" (recommended) or "npm install" before "npm run dev".\n');
  process.exit(1);
}
