import { Command } from 'commander';
import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { findGitRoot } from '@aifr/core';
import { success, info, warn, error, header } from '../lib/output.js';

const colors = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

export function importCommand(program: Command): Command {
  return program
    .command('import <agent>')
    .description('Import sessions from an AI agent (claude, codex)')
    .option('-o, --output <dir>', 'Output directory for imported sessions', '.aifr/sessions')
    .option('-l, --limit <n>', 'Maximum number of sessions to import', '10')
    .action(async (agent: string, options: { output: string; limit: string }) => {
      const validAgents = ['claude', 'codex'];
      if (!validAgents.includes(agent)) {
        error(`Invalid agent: ${agent}. Must be one of: ${validAgents.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      const limit = parseInt(options.limit, 10) || 10;

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

      header(`AIFR Import ${agent === 'claude' ? 'Claude Code' : 'Codex CLI'}`);

      try {
        if (agent === 'claude') {
          await importClaudeSessions(outputDir, limit);
        } else {
          await importCodexSessions(outputDir, limit);
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

      // Write events as JSONL
      const eventsPath = path.join(sessionDir, 'events.jsonl');
      const jsonlContent = result.events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await writeFile(eventsPath, jsonlContent, 'utf8');

      // Write metadata
      const metaPath = path.join(sessionDir, 'metadata.json');
      await writeFile(metaPath, JSON.stringify({
        sessionId: result.sessionId,
        sourceSessionId: result.sourceSessionId,
        sourceFile: result.sourceFile,
        agentType: 'claude',
        importedAt: new Date().toISOString(),
        eventCount: result.events.length,
        parseErrors: result.errors.length,
      }, null, 2), 'utf8');

      success(`  Imported ${result.events.length} events from ${colors.dim(session.projectName)}`);
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

      const eventsPath = path.join(sessionDir, 'events.jsonl');
      const jsonlContent = result.events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await writeFile(eventsPath, jsonlContent, 'utf8');

      const metaPath = path.join(sessionDir, 'metadata.json');
      await writeFile(metaPath, JSON.stringify({
        sessionId: result.sessionId,
        sourceSessionId: result.sourceSessionId,
        sourceFile: result.sourceFile,
        agentType: 'codex',
        importedAt: new Date().toISOString(),
        eventCount: result.events.length,
        parseErrors: result.errors.length,
      }, null, 2), 'utf8');

      success(`  Imported ${result.events.length} events`);
    } catch (err) {
      warn(`  Failed to import ${session.sessionId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('');
  info(`Sessions written to ${outputDir}`);
  info(`Run ${colors.cyan('aifr status')} to view imported sessions`);
}
