import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildGraph, type ExecutionGraph, type GraphEdge } from '@aifr/graph-builder';
import { findAifrDir, resolveSessionDirs, readEventsFromSession } from '../lib/session-utils.js';
import { success, info, warn, error, header } from '../lib/output.js';

const colors = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

export function graphCommand(program: Command): Command {
  return program
    .command('graph [session-id]')
    .description('Build execution graph for a session')
    .option('--all', 'Build graphs for all sessions')
    .option('--no-overwrite', 'Skip sessions that already have graph.json')
    .action(async (sessionId?: string, options?: { all?: boolean; overwrite?: boolean }) => {
      header('AIFR Graph');

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

        if (options?.overwrite === false && existsSync(graphPath)) {
          info(`${colors.dim(sessionName)}: graph.json exists, skipping`);
          continue;
        }

        console.log(`Building execution graph for ${colors.cyan(sessionName)}...\n`);

        const events = readEventsFromSession(sessionDir);
        if (events.length === 0) {
          error(`No events found for session ${sessionName}`);
          continue;
        }

        let existingEdges: GraphEdge[] = [];
        if (existsSync(graphPath)) {
          try {
            const existing: ExecutionGraph = JSON.parse(readFileSync(graphPath, 'utf8'));
            existingEdges = existing.edges.filter(e => e.source === 'manual');
          } catch { /* ignore corrupt file */ }
        }

        const metadata = JSON.parse(readFileSync(path.join(sessionDir, 'metadata.json'), 'utf8'));
        const graph = buildGraph(events, {
          sessionId: metadata.sessionId ?? sessionName,
          existingEdges,
        });

        await writeFile(graphPath, JSON.stringify(graph, null, 2));

        console.log(`  Nodes: ${graph.nodes.length}  Edges: ${graph.edges.length}  Warnings: ${graph.warnings.length}`);
        success(`Saved to ${graphPath}`);

        if (graph.warnings.length > 0) {
          console.log('');
          for (const w of graph.warnings.slice(0, 5)) {
            console.log(`  ${colors.dim('-')} ${w.message}`);
          }
          if (graph.warnings.length > 5) {
            console.log(`  ${colors.dim(`... and ${graph.warnings.length - 5} more`)}`);
          }
        }

        if (sessionDirs.length > 1) console.log('');
      }
    });
}
