import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { buildGraph, type ExecutionGraph } from '@aifr/graph-builder';
import { analyzeSession, generateReport } from '@aifr/analyzer';
import { findAifrDir, resolveSessionDirs, readEventsFromSession, readMetadataFromSession } from '../lib/session-utils.js';
import { success, info, warn, error, header } from '../lib/output.js';

const colors = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

export function reportCommand(program: Command): Command {
  return program
    .command('report [session-id]')
    .description('Generate a Markdown review report for a session')
    .option('--all', 'Generate reports for all sessions')
    .option('--no-overwrite', 'Skip sessions that already have report.md')
    .option('--output <path>', 'Output directory (default: session directory)')
    .action(async (sessionId?: string, options?: { all?: boolean; overwrite?: boolean; output?: string }) => {
      header('AIFR Report');

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
        const reportPath = options?.output
          ? path.join(options.output, `${sessionName}-report.md`)
          : path.join(sessionDir, 'report.md');

        if (options?.overwrite === false && existsSync(reportPath)) {
          info(`${colors.dim(sessionName)}: report.md exists, skipping`);
          continue;
        }

        console.log(`Generating report for ${colors.cyan(sessionName)}...\n`);

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

        // Auto-build analysis if missing
        if (!existsSync(analysisPath)) {
          const events = readEventsFromSession(sessionDir);
          if (events.length === 0) {
            error(`No events found for session ${sessionName}`);
            continue;
          }
          const graph: ExecutionGraph = JSON.parse(readFileSync(graphPath, 'utf8'));
          const metadata = readMetadataFromSession(sessionDir);
          const analysis = analyzeSession(graph, events, {
            agentType: metadata.agentType ?? 'unknown',
            durationMs: metadata.durationMs,
          });
          await writeFile(analysisPath, JSON.stringify(analysis, null, 2));
          info(`  Auto-built analysis.json`);
        }

        // Read graph + analysis + events
        const graph: ExecutionGraph = JSON.parse(readFileSync(graphPath, 'utf8'));
        const analysis = JSON.parse(readFileSync(analysisPath, 'utf8'));
        const events = readEventsFromSession(sessionDir);

        const markdown = generateReport(graph, analysis, events);

        // Ensure output directory exists
        const outputDir = path.dirname(reportPath);
        if (!existsSync(outputDir)) {
          await mkdir(outputDir, { recursive: true });
        }

        await writeFile(reportPath, markdown, 'utf8');
        success(`Report saved to ${reportPath}`);

        if (sessionDirs.length > 1) console.log('');
      }
    });
}
