import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const webDir = path.join(root, 'apps', 'web');
const nextDir = path.join(webDir, '.next');
const cliDistWeb = path.join(root, 'apps', 'cli', 'dist', 'web');

// Verify essential build outputs exist
const essentialFiles = ['server', 'static', 'BUILD_ID'];
for (const name of essentialFiles) {
  if (!existsSync(path.join(nextDir, name))) {
    console.error(`Error: .next/${name} not found. Run "pnpm --filter @aifr/web build" first.`);
    process.exit(1);
  }
}

// Clean and create target
if (existsSync(cliDistWeb)) {
  try {
    rmSync(cliDistWeb, { recursive: true });
  } catch {
    // Directory may be locked by a running dev server — overwrite instead
  }
}
mkdirSync(cliDistWeb, { recursive: true });

// Copy all .next/ root-level files (BUILD_ID, manifests, etc.)
const nextEntries = readdirSync(nextDir);
for (const entry of nextEntries) {
  if (entry === 'standalone' || entry === 'cache' || entry === 'trace') continue;
  const src = path.join(nextDir, entry);
  const dst = path.join(cliDistWeb, '.next', entry);
  if (statSync(src).isDirectory()) {
    cpSync(src, dst, { recursive: true });
  } else {
    cpSync(src, dst);
  }
}

console.log('Web UI packed to', cliDistWeb);
