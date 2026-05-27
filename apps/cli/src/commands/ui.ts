import { Command } from 'commander';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
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
  spawn(cmd, [url], { stdio: 'ignore', detached: true }).unref();
}

export function uiCommand(program: Command): Command {
  return program
    .command('ui')
    .description('Start the AIFR Web UI')
    .option('-p, --port <port>', 'Port to run the server on', '3000')
    .option('--no-open', 'Do not open the browser automatically')
    .action(async (options: { port: string; open: boolean }) => {
      // Locate the standalone server relative to this compiled file
      const thisDir = path.dirname(fileURLToPath(import.meta.url));
      const serverPath = path.join(thisDir, '..', 'web', 'apps', 'web', 'server.js');

      if (!existsSync(serverPath)) {
        error('Web UI not found. Run "aifr ui" from a full installation or build from source.');
        info('Install: npm i -g aifr');
        process.exitCode = 1;
        return;
      }

      const port = await findFreePort(parseInt(options.port, 10) || 3000);
      const host = 'localhost';
      const url = `http://${host}:${port}`;

      info(`Starting AIFR Web UI on ${url}...`);

      const env = {
        ...process.env,
        PORT: String(port),
        HOSTNAME: host,
      };

      const proc = spawn(process.execPath, [serverPath], {
        cwd: path.dirname(serverPath),
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

      // Open browser after a short delay
      if (options.open) {
        setTimeout(() => {
          success(`Web UI running at ${url}`);
          openBrowser(url);
        }, 1500);
      } else {
        setTimeout(() => success(`Web UI running at ${url}`), 1500);
      }

      // Graceful shutdown
      const shutdown = () => {
        info('Shutting down...');
        proc.kill('SIGTERM');
        setTimeout(() => process.exit(0), 1000);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });
}
