import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { info, error, success } from '../lib/output.js';

function findFreePort(start = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(start, () => {
      const addr = server.address();
      server.close(() => resolve(typeof addr === 'object' ? addr.port : start));
    });
    server.on('error', () => {
      if (start < 65535) resolve(findFreePort(start + 1));
      else reject(new Error('No free port found'));
    });
  });
}

function openBrowser(url: string): void {
  const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: true }).unref();
}

function findWebDir(): string | null {
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = path.dirname(thisFile);

  // Try locations in order of likelihood:
  // 1. Compiled npm package: <pkg>/dist/web/.next/server
  // 2. Dev mode (tsx): <cli>/dist/web/.next/server (pack-web writes here)
  // 3. Alternative: <cli>/src/../dist/web/.next/server
  const candidates = [
    path.join(thisDir, 'web'),                          // compiled: dist/web
    path.join(thisDir, '..', 'dist', 'web'),            // dev: src/../dist/web
    path.join(thisDir, '..', '..', 'dist', 'web'),      // fallback
  ];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (existsSync(path.join(resolved, '.next', 'server'))) {
      return resolved;
    }
  }
  return null;
}

function findNextBin(webDir: string): string {
  const pkgRoot = path.dirname(path.dirname(webDir));
  const isWin = process.platform === 'win32';

  // Check package-level node_modules
  const pkgNmBin = path.join(pkgRoot, 'node_modules', '.bin');
  const candidates = isWin
    ? ['next.cmd', 'next']
    : ['next', 'next.cmd'];
  for (const name of candidates) {
    const p = path.join(pkgNmBin, name);
    if (existsSync(p)) return p;
  }

  // Check monorepo root node_modules (dev mode)
  const monoRoot = path.join(pkgRoot, '..', '..', 'node_modules', '.bin');
  for (const name of candidates) {
    const p = path.join(monoRoot, name);
    if (existsSync(p)) return p;
  }

  return 'next';
}

export function uiCommand(program: Command): Command {
  return program
    .command('ui')
    .description('Start the AIFR Web UI')
    .option('-p, --port <port>', 'Port to run the server on', '3000')
    .option('--no-open', 'Do not open the browser automatically')
    .action(async (options: { port: string; open: boolean }) => {
      const webDir = findWebDir();

      if (!webDir) {
        error('Web UI not found. Run "aifr ui" from a full installation or build from source.');
        info('Install: npm i -g aifr');
        process.exitCode = 1;
        return;
      }

      const port = await findFreePort(parseInt(options.port, 10) || 3000);
      const host = 'localhost';
      const url = `http://${host}:${port}`;

      const nextBin = findNextBin(webDir);

      info(`Starting AIFR Web UI on ${url}...`);

      const env = {
        ...process.env,
        PORT: String(port),
        HOSTNAME: host,
        AIFR_PROJECT_PATH: process.cwd(),
      };

      // On Windows, .cmd files need to be executed via shell
      const isWindowsCmd = nextBin.endsWith('.cmd');
      const proc = isWindowsCmd
        ? spawn(`"${nextBin}" start`, {
            cwd: webDir,
            env,
            stdio: 'inherit',
            shell: true,
          })
        : spawn(nextBin, ['start'], {
            cwd: webDir,
            env,
            stdio: 'inherit',
          });

      proc.on('error', (err) => {
        error(`Failed to start server: ${err.message}`);
        process.exitCode = 1;
      });

      proc.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          error(`Server exited with code ${code}`);
        }
      });

      if (options.open) {
        setTimeout(() => {
          success(`Web UI running at ${url}`);
          openBrowser(url);
        }, 1500);
      } else {
        setTimeout(() => success(`Web UI running at ${url}`), 1500);
      }

      const shutdown = () => {
        info('Shutting down...');
        proc.kill('SIGTERM');
        setTimeout(() => process.exit(0), 1000);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });
}
