import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { findAifrDir, resolveSessionDirs, readEventsFromSession } from '../lib/session-utils.js';
import { success, warn, error, header, info } from '../lib/output.js';
import type { AIFREvent } from '@aifr/event-schema';

const colors = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

interface DiffFileInfo {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  previousPath?: string;
}

interface DiffEntry {
  eventIndex: number;
  timestamp: number;
  files: DiffFileInfo[];
  totalAdditions: number;
  totalDeletions: number;
  isBaseline: boolean;
  patch?: string;
}

function extractDiffEvents(events: AIFREvent[]): DiffEntry[] {
  return events
    .map((e, i) => {
      if (e.type !== 'diff') return null;
      const d = e as Record<string, unknown>;
      return {
        eventIndex: i,
        timestamp: d.timestamp as number,
        files: (d.files as DiffFileInfo[]) ?? [],
        totalAdditions: (d.totalAdditions as number) ?? 0,
        totalDeletions: (d.totalDeletions as number) ?? 0,
        isBaseline: (d.isBaseline as boolean) ?? false,
        patch: d.patch as string | undefined,
      };
    })
    .filter((d): d is DiffEntry => d !== null);
}

function colorizePatch(patch: string, fileFilter?: string): string {
  const lines = patch.split('\n');
  const result: string[] = [];
  let skipFile = false;

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
      if (match) {
        const filePath = match[2];
        skipFile = fileFilter ? !filePath.includes(fileFilter) : false;
      }
      if (!skipFile) result.push(colors.cyan(line));
      continue;
    }

    if (skipFile) continue;

    if (line.startsWith('+++') || line.startsWith('---')) {
      result.push(colors.bold(line));
    } else if (line.startsWith('@@')) {
      result.push(colors.cyan(line));
    } else if (line.startsWith('+')) {
      result.push(colors.green(line));
    } else if (line.startsWith('-')) {
      result.push(colors.red(line));
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

function printStatTable(diffs: DiffEntry[]): void {
  console.log(colors.bold('  File Changes:'));
  console.log('');

  const allFiles = new Map<string, DiffFileInfo & { diffIndex: number }>();
  for (const diff of diffs) {
    for (const f of diff.files) {
      const key = f.path;
      const existing = allFiles.get(key);
      if (existing) {
        existing.additions += f.additions;
        existing.deletions += f.deletions;
      } else {
        allFiles.set(key, { ...f, diffIndex: diff.eventIndex });
      }
    }
  }

  for (const [, f] of allFiles) {
    const statusIcon = f.status === 'added' ? colors.green('+')
      : f.status === 'deleted' ? colors.red('-')
      : f.status === 'renamed' ? colors.yellow('~')
      : colors.dim('M');
    const addStr = f.additions > 0 ? colors.green(`+${f.additions}`) : '';
    const delStr = f.deletions > 0 ? colors.red(`-${f.deletions}`) : '';
    const stats = [addStr, delStr].filter(Boolean).join(' ');
    console.log(`  ${statusIcon} ${f.path}  ${colors.dim(stats)}`);
  }
}

export function diffCommand(program: Command): Command {
  return program
    .command('diff [session-id]')
    .description('View code changes captured in a session')
    .option('--stat', 'Show file change summary only')
    .option('--file <pattern>', 'Filter to specific file pattern')
    .option('--git', 'Show git before/after patches instead of diff events')
    .option('--before', 'Show git before-patch only')
    .option('--after', 'Show git after-patch only')
    .action(async (sessionId?: string, options?: { stat?: boolean; file?: string; git?: boolean; before?: boolean; after?: boolean }) => {
      header('AIFR Diff');

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

      if (options?.git || options?.before || options?.after) {
        showGitPatches(sessionDir, sessionName, options);
        return;
      }

      const events = readEventsFromSession(sessionDir);
      if (events.length === 0) {
        error(`No events found for session ${sessionName}`);
        return;
      }

      const diffs = extractDiffEvents(events);
      if (diffs.length === 0) {
        info(`No diff events in session ${sessionName}.`);
        info('Use --git to view before/after git patches.');
        return;
      }

      const totalAdd = diffs.reduce((s, d) => s + d.totalAdditions, 0);
      const totalDel = diffs.reduce((s, d) => s + d.totalDeletions, 0);
      const totalFiles = new Set(diffs.flatMap(d => d.files.map(f => f.path))).size;

      console.log(`  Session: ${colors.cyan(sessionName)}`);
      console.log(`  ${diffs.length} diffs: ${totalFiles} files changed, ${colors.green(`+${totalAdd}`)} ${colors.red(`-${totalDel}`)}`);
      console.log('');

      if (options?.stat) {
        printStatTable(diffs);
        return;
      }

      for (const diff of diffs) {
        const label = diff.isBaseline ? colors.yellow('[baseline]') : '';
        const ts = new Date(diff.timestamp).toLocaleTimeString();
        console.log(colors.dim(`--- Diff at ${ts} ${label} ---`));

        if (diff.patch) {
          console.log(colorizePatch(diff.patch, options?.file));
        } else {
          for (const f of diff.files) {
            if (options?.file && !f.path.includes(options.file)) continue;
            const status = f.status === 'added' ? colors.green('added')
              : f.status === 'deleted' ? colors.red('deleted')
              : f.status === 'renamed' ? colors.yellow('renamed')
              : 'modified';
            console.log(`  ${f.path} (${status}) ${colors.green(`+${f.additions}`)} ${colors.red(`-${f.deletions}`)}`);
          }
        }

        console.log('');
      }

      success(`Shown ${diffs.length} diffs`);
    });
}

function showGitPatches(sessionDir: string, sessionName: string, options?: { before?: boolean; after?: boolean; file?: string }): void {
  const gitDir = path.join(sessionDir, 'git');

  const patches: { label: string; filename: string }[] = [];
  if (options?.before || (!options?.after && !options?.before)) {
    patches.push({ label: 'Before', filename: 'before.patch' });
  }
  if (options?.after || (!options?.after && !options?.before)) {
    patches.push({ label: 'After', filename: 'after.patch' });
  }

  for (const { label, filename } of patches) {
    const patchPath = path.join(gitDir, filename);
    if (!existsSync(patchPath)) {
      info(`No ${label.toLowerCase()} patch available for ${sessionName}`);
      continue;
    }

    const content = readFileSync(patchPath, 'utf8');
    if (!content.trim()) {
      info(`${label} patch is empty (no changes)`);
      continue;
    }

    console.log(colors.bold(`  ${label} Patch:`));
    console.log(colors.dim('─'.repeat(50)));
    console.log(colorizePatch(content, options?.file));
    console.log('');
  }

  success(`Git patches for ${sessionName}`);
}
