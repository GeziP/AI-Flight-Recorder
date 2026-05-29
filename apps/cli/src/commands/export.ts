import { Command } from 'commander';
import { existsSync, statSync, createWriteStream as fsCreateWriteStream } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { findAifrDir, resolveSessionDirs } from '../lib/session-utils.js';
import { success, warn, error, header, info, colors } from '../lib/output.js';

const SESSION_FILES = [
  'metadata.json',
  'events.jsonl',
  'graph.json',
  'analysis.json',
  'report.md',
  'terminal.log',
];

const SESSION_DIRS = ['git', 'replay', 'redacted'];

interface ManifestEntry {
  path: string;
  size: number;
}

async function collectSessionFiles(sessionDir: string): Promise<ManifestEntry[]> {
  const entries: ManifestEntry[] = [];

  for (const file of SESSION_FILES) {
    const filePath = path.join(sessionDir, file);
    if (existsSync(filePath)) {
      entries.push({ path: file, size: statSync(filePath).size });
    }
  }

  for (const dir of SESSION_DIRS) {
    const dirPath = path.join(sessionDir, dir);
    if (!existsSync(dirPath)) continue;
    const files = await readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        entries.push({ path: `${dir}/${file}`, size: statSync(filePath).size });
      }
    }
  }

  return entries;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function exportCommand(program: Command): Command {
  return program
    .command('export [session-id]')
    .description('Export a session as a portable archive')
    .option('--output <path>', 'Output file path (default: <session-name>.aifr.tar.gz)')
    .option('--dry-run', 'List files to be exported without creating archive')
    .option('--no-meta', 'Exclude metadata.json from manifest')
    .action(async (sessionId?: string, options?: { output?: string; dryRun?: boolean; meta?: boolean }) => {
      header('AIFR Export');

      const aifrDir = await findAifrDir();
      if (!aifrDir) {
        warn('AIFR is not initialized in this project.');
        return;
      }

      const sessionDirs = resolveSessionDirs(aifrDir, sessionId, false);
      if (sessionDirs.length === 0) {
        warn('No sessions found.');
        return;
      }

      const sessionDir = sessionDirs[0];
      const sessionName = sessionDir.split(/[/\\]/).pop()!;

      const files = await collectSessionFiles(sessionDir);
      if (files.length === 0) {
        error(`No files found in session ${sessionName}`);
        return;
      }

      const totalSize = files.reduce((s, f) => s + f.size, 0);
      console.log(`  Session: ${colors.cyan(sessionName)}`);
      console.log(`  Files: ${files.length} (${formatBytes(totalSize)})`);
      console.log('');

      if (options?.dryRun) {
        console.log(colors.bold('  Files to export:'));
        for (const f of files) {
          console.log(`    ${colors.dim(f.path)} (${formatBytes(f.size)})`);
        }
        return;
      }

      const outputPath = options?.output ?? `${sessionName}.aifr.tar`;
      const outputGzPath = outputPath.endsWith('.gz') ? outputPath : `${outputPath}.gz`;
      const tarPath = outputPath.endsWith('.gz') ? outputPath.replace(/\.gz$/, '') : outputPath;

      console.log(colors.bold('  Files:'));
      for (const f of files) {
        console.log(`    ${colors.dim(f.path)} (${formatBytes(f.size)})`);
      }
      console.log('');

      await buildTarGz(sessionDir, files, tarPath, outputGzPath);

      success(`Exported to ${outputGzPath} (${formatBytes(statSync(outputGzPath).size)})`);
    });
}

async function buildTarGz(sessionDir: string, files: ManifestEntry[], tarPath: string, gzPath: string): Promise<void> {
  const { createGzip } = await import('node:zlib');

  // Simple tar-like format: concatenate all files with headers
  // Using a custom minimal format since node-tar is not a dependency
  const chunks: Buffer[] = [];

  for (const file of files) {
    const filePath = path.join(sessionDir, file.path);
    const content = await readFile(filePath);

    // Header: JSON line with path and size, separated by newline
    const header = Buffer.from(`FILE:${file.path}\n${content.length}\n`);
    const footer = Buffer.from('\n');

    chunks.push(header);
    chunks.push(content);
    chunks.push(footer);
  }

  // Add manifest
  const manifest = JSON.stringify({
    version: '0.2.0',
    exportedAt: new Date().toISOString(),
    files: files.map(f => ({ path: f.path, size: f.size })),
  });
  chunks.unshift(Buffer.from(`AIFR_ARCHIVE:0.2.0\nMANIFEST:${manifest}\n`));

  const combined = Buffer.concat(chunks);

  const gzip = createGzip();
  const ws = fsCreateWriteStream(gzPath);

  await pipeline(Readable.from(combined), gzip, ws);
}
