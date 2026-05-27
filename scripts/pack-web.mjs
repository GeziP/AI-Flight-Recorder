import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const webStandalone = path.join(root, 'apps', 'web', '.next', 'standalone');
const webStatic = path.join(root, 'apps', 'web', '.next', 'static');
const cliDistWeb = path.join(root, 'apps', 'cli', 'dist', 'web');

if (!existsSync(webStandalone)) {
  console.error('Error: Web UI standalone build not found at', webStandalone);
  console.error('Run "pnpm build" first.');
  process.exit(1);
}

// Clean and create target
mkdirSync(cliDistWeb, { recursive: true });

// Copy standalone server
cpSync(webStandalone, cliDistWeb, { recursive: true });

// Copy static assets into the correct location within standalone
const targetStaticDir = path.join(cliDistWeb, 'apps', 'web', '.next', 'static');
if (existsSync(webStatic)) {
  mkdirSync(targetStaticDir, { recursive: true });
  cpSync(webStatic, targetStaticDir, { recursive: true });
}

console.log('Web UI packed to', cliDistWeb);
