import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { redactEvents } from '@aifr/analyzer';
import { findAifrDir, resolveSessionDirs, readEventsFromSession } from '../lib/session-utils.js';
import { success, info, warn, error, header } from '../lib/output.js';

const colors = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

export function redactCommand(program: Command): Command {
  return program
    .command('redact [session-id]')
    .description('Detect and redact secrets from session events')
    .option('--all', 'Redact all sessions')
    .option('--output <path>', 'Output directory (default: session directory with .redacted suffix)')
    .option('--dry-run', 'Show what would be redacted without writing files')
    .option('--json', 'Output results as JSON')
    .action(async (sessionId?: string, options?: { all?: boolean; output?: string; dryRun?: boolean; json?: boolean }) => {
      header('AIFR Redact');

      const aifrDir = await findAifrDir();
      if (!aifrDir) {
        warn('AIFR is not initialized in this project.');
        return;
      }

      const sessionDirs = resolveSessionDirs(aifrDir, sessionId, options?.all);
      if (sessionDirs.length === 0) {
        warn('No sessions found.');
        return;
      }

      for (const sessionDir of sessionDirs) {
        const sessionName = path.basename(sessionDir);
        console.log(`Scanning ${colors.cyan(sessionName)}...\n`);

        const events = readEventsFromSession(sessionDir);
        if (events.length === 0) {
          error(`No events found for session ${sessionName}`);
          continue;
        }

        const result = redactEvents(events);

        if (options?.json) {
          console.log(JSON.stringify({ sessionId: sessionName, ...result }, null, 2));
          if (sessionDirs.length > 1) console.log('');
          continue;
        }

        console.log(`  Scanned: ${result.totalScanned} events`);
        if (result.totalRedacted > 0) {
          console.log(`  ${colors.yellow('Redacted')}: ${result.totalRedacted} secret(s) found`);
          console.log('');
          console.log(`  By rule:`);
          for (const [rule, count] of Object.entries(result.matchesByRule)) {
            console.log(`    ${colors.dim('-')} ${rule}: ${count}`);
          }
        } else {
          console.log(`  ${colors.green('Clean')}: No secrets detected`);
        }

        if (options?.dryRun) {
          console.log('');
          info('(dry run, no files written)');
          if (sessionDirs.length > 1) console.log('');
          continue;
        }

        // Write redacted events
        const outputDir = options?.output
          ? options.output
          : path.join(sessionDir, 'redacted');
        if (!existsSync(outputDir)) {
          await mkdir(outputDir, { recursive: true });
        }

        const outputPath = path.join(outputDir, 'events.jsonl');
        const jsonl = result.events.map(e => JSON.stringify(e)).join('\n');
        await writeFile(outputPath, jsonl, 'utf8');

        // Copy metadata if exists
        const metaPath = path.join(sessionDir, 'metadata.json');
        if (existsSync(metaPath)) {
          const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
          meta.redacted = true;
          meta.redactedAt = new Date().toISOString();
          await writeFile(path.join(outputDir, 'metadata.json'), JSON.stringify(meta, null, 2));
        }

        success(`Redacted session saved to ${outputPath}`);

        if (sessionDirs.length > 1) console.log('');
      }
    });
}
