import { Command } from 'commander';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { findGitRoot, getFullDiff, getDiffStat, isGitRepo } from '@aifr/core';
import type { DiffEvent } from '@aifr/event-schema';
import { success, info, warn, error, header } from '../lib/output.js';

const colors = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

/** Extract the working directory from the first attachment/system entry in a Claude JSONL session. */
async function extractCwdFromSession(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, 'utf8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.cwd && typeof entry.cwd === 'string') return entry.cwd;
      } catch { /* skip malformed lines */ }
    }
  } catch { /* file not readable */ }
  return null;
}

export function importCommand(program: Command): Command {
  return program
    .command('import <agent>')
    .description('Import sessions from an AI agent (claude, codex, cursor)')
    .option('-o, --output <dir>', 'Output directory for imported sessions', '.aifr/sessions')
    .option('-l, --limit <n>', 'Maximum number of sessions to import')
    .action(async (agent: string, options: { output: string; limit?: string }) => {
      const validAgents = ['claude', 'codex', 'cursor'];
      if (!validAgents.includes(agent)) {
        error(`Invalid agent: ${agent}. Must be one of: ${validAgents.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      const limit = options.limit ? parseInt(options.limit, 10) : Infinity;

      // Default output resolves relative to git root so sessions land in the
      // right place when run from a subdirectory. Explicit --output paths
      // resolve relative to cwd to respect user intent.
      const isDefaultOutput = options.output === '.aifr/sessions';
      const baseDir = isDefaultOutput
        ? (await findGitRoot(process.cwd())) ?? process.cwd()
        : process.cwd();
      const outputDir = path.isAbsolute(options.output)
        ? options.output
        : path.resolve(baseDir, options.output);

      header(`AIFR Import ${agent === 'claude' ? 'Claude Code' : agent === 'codex' ? 'Codex CLI' : 'Cursor'}`);

      try {
        if (agent === 'claude') {
          await importClaudeSessions(outputDir, limit);
        } else if (agent === 'codex') {
          await importCodexSessions(outputDir, limit);
        } else {
          await importCursorSessions(outputDir, limit);
        }
      } catch (err) {
        error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}

async function importClaudeSessions(outputDir: string, limit: number): Promise<void> {
  const { discoverClaudeSessions, importClaudeSession } = await import('@aifr/parser-claude');

  const sessions = await discoverClaudeSessions();
  info(`Found ${sessions.length} Claude Code session(s)`);

  if (sessions.length === 0) {
    warn('No sessions found. Make sure Claude Code has been used in some projects.');
    return;
  }

  const toImport = sessions.slice(0, limit);
  info(`Importing ${toImport.length} session(s)...\n`);

  for (const session of toImport) {
    try {
      const result = await importClaudeSession(session.sessionFile);

      if (result.errors.length > 0) {
        warn(`  ${session.sessionId}: ${result.errors.length} parse error(s)`);
      }

      // Write events to output directory
      const sessionDir = path.resolve(outputDir, `imported-claude-${result.sourceSessionId}`);
      await mkdir(sessionDir, { recursive: true });

      // Attempt to capture git diff from the session's original project directory.
      // Parse the cwd from the first attachment entry in the source file.
      const events = [...result.events];
      let gitInfo = { hasDiff: false, patch: '', gitRoot: '' };
      const sessionCwd = await extractCwdFromSession(session.sessionFile);
      if (sessionCwd && await isGitRepo(sessionCwd)) {
        const gitRoot = await findGitRoot(sessionCwd);
        if (gitRoot) {
          const patch = await getFullDiff(gitRoot);
          if (patch.trim()) {
            const gitDir = path.join(sessionDir, 'git');
            await mkdir(gitDir, { recursive: true });
            await writeFile(path.join(gitDir, 'after.patch'), patch, 'utf8');

            const stat = await getDiffStat(gitRoot);
            const baselineDiff: DiffEvent = {
              id: `diff-baseline-${result.sourceSessionId}`,
              sessionId: result.sessionId,
              type: 'diff',
              timestamp: Date.now(),
              schemaVersion: '0.1.0',
              files: stat.files.map(f => ({
                path: f.path,
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
                previousPath: f.previousPath,
              })),
              totalAdditions: stat.totalAdditions,
              totalDeletions: stat.totalDeletions,
              isBaseline: false,
              patch,
              snapshotLabel: 'Captured at import time',
            };
            events.unshift(baselineDiff);
            gitInfo = { hasDiff: true, patch, gitRoot };
          }
        }
      }

      // Write events as JSONL
      const eventsPath = path.join(sessionDir, 'events.jsonl');
      const jsonlContent = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await writeFile(eventsPath, jsonlContent, 'utf8');

      // Write metadata
      const metaPath = path.join(sessionDir, 'metadata.json');
      await writeFile(metaPath, JSON.stringify({
        sessionId: result.sessionId,
        sourceSessionId: result.sourceSessionId,
        sourceFile: result.sourceFile,
        agentType: 'claude',
        status: 'completed',
        importedAt: new Date().toISOString(),
        eventCount: events.length,
        parseErrors: result.errors.length,
        gitRoot: gitInfo.gitRoot || null,
        gitDiffCaptured: gitInfo.hasDiff,
      }, null, 2), 'utf8');

      const diffNote = gitInfo.hasDiff
        ? ` (+ git diff captured)`
        : colors.dim(' (no git diff)');
      success(`  Imported ${events.length} events from ${colors.dim(session.projectName)}${diffNote}`);
    } catch (err) {
      warn(`  Failed to import ${session.sessionId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('');
  info(`Sessions written to ${outputDir}`);
  info(`Run ${colors.cyan('aifr status')} to view imported sessions`);
}

async function importCodexSessions(outputDir: string, limit: number): Promise<void> {
  const { discoverCodexSessions, importCodexSession } = await import('@aifr/parser-codex');

  const sessions = await discoverCodexSessions();
  info(`Found ${sessions.length} Codex CLI session(s)`);

  if (sessions.length === 0) {
    warn('No sessions found. Make sure Codex CLI has been used.');
    return;
  }

  const toImport = sessions.slice(0, limit);
  info(`Importing ${toImport.length} session(s)...\n`);

  for (const session of toImport) {
    try {
      const result = await importCodexSession(session.sessionFile);

      if (result.errors.length > 0) {
        warn(`  ${session.sessionId}: ${result.errors.length} parse error(s)`);
      }

      const sessionDir = path.resolve(outputDir, `imported-codex-${result.sourceSessionId}`);
      await mkdir(sessionDir, { recursive: true });

      // Attempt to capture git diff from the session's working directory
      const events = [...result.events];
      let gitInfo = { hasDiff: false, patch: '', gitRoot: '' };
      if (session.cwd && await isGitRepo(session.cwd)) {
        const gitRoot = await findGitRoot(session.cwd);
        if (gitRoot) {
          const patch = await getFullDiff(gitRoot);
          if (patch.trim()) {
            const gitDir = path.join(sessionDir, 'git');
            await mkdir(gitDir, { recursive: true });
            await writeFile(path.join(gitDir, 'after.patch'), patch, 'utf8');

            const stat = await getDiffStat(gitRoot);
            const baselineDiff: DiffEvent = {
              id: `diff-baseline-${result.sourceSessionId}`,
              sessionId: result.sessionId,
              type: 'diff',
              timestamp: Date.now(),
              schemaVersion: '0.1.0',
              files: stat.files.map(f => ({
                path: f.path,
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
                previousPath: f.previousPath,
              })),
              totalAdditions: stat.totalAdditions,
              totalDeletions: stat.totalDeletions,
              isBaseline: false,
              patch,
              snapshotLabel: 'Captured at import time',
            };
            events.unshift(baselineDiff);
            gitInfo = { hasDiff: true, patch, gitRoot };
          }
        }
      }

      const eventsPath = path.join(sessionDir, 'events.jsonl');
      const jsonlContent = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await writeFile(eventsPath, jsonlContent, 'utf8');

      const metaPath = path.join(sessionDir, 'metadata.json');
      await writeFile(metaPath, JSON.stringify({
        sessionId: result.sessionId,
        sourceSessionId: result.sourceSessionId,
        sourceFile: result.sourceFile,
        agentType: 'codex',
        status: 'completed',
        importedAt: new Date().toISOString(),
        eventCount: events.length,
        parseErrors: result.errors.length,
        gitRoot: gitInfo.gitRoot || null,
        gitDiffCaptured: gitInfo.hasDiff,
      }, null, 2), 'utf8');

      const diffNote = gitInfo.hasDiff
        ? ` (+ git diff captured)`
        : colors.dim(' (no git diff)');
      success(`  Imported ${events.length} events${diffNote}`);
    } catch (err) {
      warn(`  Failed to import ${session.sessionId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('');
  info(`Sessions written to ${outputDir}`);
  info(`Run ${colors.cyan('aifr status')} to view imported sessions`);
}

async function importCursorSessions(outputDir: string, limit: number): Promise<void> {
  const { discoverCursorSessions, importCursorSession } = await import('@aifr/parser-cursor');

  const sessions = discoverCursorSessions();
  info(`Found ${sessions.length} Cursor workspace(s) with AI data`);

  if (sessions.length === 0) {
    warn('No Cursor AI sessions found. Make sure Cursor has been used with AI features.');
    return;
  }

  const toImport = sessions.slice(0, limit);
  info(`Importing ${toImport.length} workspace(s)...\n`);

  for (const session of toImport) {
    try {
      const result = importCursorSession(session);

      if (result.errors.length > 0) {
        warn(`  ${session.workspaceName}: ${result.errors.length} parse error(s)`);
      }

      const sessionDir = path.resolve(outputDir, `imported-cursor-${result.sourceSessionId}`);
      await mkdir(sessionDir, { recursive: true });

      const events = [...result.events];
      const eventsPath = path.join(sessionDir, 'events.jsonl');
      const jsonlContent = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await writeFile(eventsPath, jsonlContent, 'utf8');

      const metaPath = path.join(sessionDir, 'metadata.json');
      await writeFile(metaPath, JSON.stringify({
        sessionId: result.sessionId,
        sourceSessionId: result.sourceSessionId,
        sourceFile: result.sourceFile,
        agentType: 'cursor',
        status: 'completed',
        importedAt: new Date().toISOString(),
        eventCount: events.length,
        parseErrors: result.errors.length,
        workspaceName: session.workspaceName,
      }, null, 2), 'utf8');

      const genCount = session.generations.length;
      success(`  Imported ${genCount} AI generations from ${colors.dim(session.workspaceName)}`);
    } catch (err) {
      warn(`  Failed to import ${session.workspaceName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('');
  info(`Sessions written to ${outputDir}`);
  info(`Run ${colors.cyan('aifr status')} to view imported sessions`);
}
