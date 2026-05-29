import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildGraph, type GraphEdge, type ExecutionGraph } from '@aifr/graph-builder';
import { analyzeSession } from '@aifr/analyzer';
import { findAifrDir, resolveSessionDirs, readEventsFromSession, readMetadataFromSession } from '../lib/session-utils.js';
import { success, info, warn, error, header } from '../lib/output.js';

const colors = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};

export function analyzeCommand(program: Command): Command {
  return program
    .command('analyze [session-id]')
    .description('Analyze a session (auto-builds graph if missing)')
    .option('--all', 'Analyze all sessions')
    .option('--no-overwrite', 'Skip sessions that already have analysis.json')
    .action(async (sessionId?: string, options?: { all?: boolean; overwrite?: boolean }) => {
      header('AIFR Analyze');

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
        const graphPath = path.join(sessionDir, 'graph.json');
        const analysisPath = path.join(sessionDir, 'analysis.json');

        if (options?.overwrite === false && existsSync(analysisPath)) {
          info(`${colors.dim(sessionName)}: analysis.json exists, skipping`);
          continue;
        }

        console.log(`Analyzing ${colors.cyan(sessionName)}...\n`);

        // Auto-build graph if missing
        if (!existsSync(graphPath)) {
          const events = readEventsFromSession(sessionDir);
          if (events.length === 0) {
            error(`No events found for session ${sessionName}`);
            continue;
          }
          const metadata = readMetadataFromSession(sessionDir);
          const graph = buildGraph(events, { sessionId: metadata.sessionId ?? sessionName });
          await writeFile(graphPath, JSON.stringify(graph, null, 2));
          info(`  Auto-built graph.json (${graph.nodes.length} nodes, ${graph.edges.length} edges)`);
        }

        // Read graph + events + metadata
        const graph: ExecutionGraph = JSON.parse(
          readFileSync(graphPath, 'utf8'),
        );
        const events = readEventsFromSession(sessionDir);
        const metadata = readMetadataFromSession(sessionDir);

        const analysis = analyzeSession(graph, events, {
          agentType: metadata.agentType ?? 'unknown',
          durationMs: metadata.durationMs,
        });

        await writeFile(analysisPath, JSON.stringify(analysis, null, 2));

        // Print summary
        const s = analysis.summary;
        console.log(`  Summary:`);
        console.log(`    Prompts: ${s.totalPrompts}  Commands: ${s.totalCommands}  Files changed: ${s.totalDiffFiles}`);
        console.log(`    +${s.totalAdditions}/-${s.totalDeletions}  Tests: ${colors.green(`${s.testsPassed} pass`)} / ${s.testsFailed > 0 ? colors.red(`${s.testsFailed} fail`) : `${s.testsFailed} fail`}  Retries: ${s.retryCount}`);

        const a = analysis.attribution;
        console.log(`\n  Attribution:`);
        console.log(`    ${a.totalDiffs} diffs: ${a.byConfidence.high} high / ${a.byConfidence.medium} medium / ${a.byConfidence.low} low / ${a.unattributed} unattributed`);

        if (analysis.retryGroups.length > 0) {
          console.log(`\n  Retry Analysis:`);
          console.log(`    ${analysis.retryGroups.length} retry group(s) detected`);
          for (const rg of analysis.retryGroups.slice(0, 3)) {
            const files = rg.hotspotFiles.length > 0
              ? ` — Hotspot: ${rg.hotspotFiles.join(', ')}`
              : '';
            console.log(`    ${colors.dim('-')} ${rg.id}${files}`);
          }
        }

        success(`Saved to ${analysisPath}`);

        if (analysis.warnings.length > 0) {
          console.log('');
          for (const w of analysis.warnings.slice(0, 3)) {
            console.log(`  ${colors.yellow('!')} ${w.message}`);
          }
        }

        if (sessionDirs.length > 1) console.log('');
      }
    });
}
