import { Command } from 'commander';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { SessionSearchIndex } from '@aifr/search';
import { findAifrDir } from '../lib/session-utils.js';
import { success, warn, error, header, info, colors } from '../lib/output.js';

export function searchCommand(program: Command): Command {
  return program
    .command('search <query>')
    .description('Search across sessions using full-text search')
    .option('--limit <n>', 'Maximum results to return', '20')
    .option('--session <id>', 'Filter to a specific session')
    .option('--type <type>', 'Filter by event type (prompt, command, diff, tool, test)')
    .option('--reindex', 'Rebuild search index from scratch')
    .action(async (query: string, options?: { limit?: string; session?: string; type?: string; reindex?: boolean }) => {
      header('AIFR Search');

      const aifrDir = await findAifrDir();
      if (!aifrDir) {
        warn('AIFR is not initialized in this project.');
        return;
      }

      const sessionsDir = path.join(aifrDir, 'sessions');
      if (!existsSync(sessionsDir)) {
        warn('No sessions directory found.');
        return;
      }

      const dbPath = path.join(aifrDir, DB_FILENAME);
      const index = new SessionSearchIndex(dbPath);

      try {
        if (options?.reindex || index.getSessionCount() === 0) {
          info('Building search index...');
          const result = index.indexAll(sessionsDir);
          if (result.total === 0) {
            warn('No sessions found to index.');
            return;
          }
          success(`Indexed ${result.indexed} events from ${result.total} sessions`);
          console.log('');
        }

        const limit = parseInt(options?.limit ?? '20', 10);
        const results = index.search(query, {
          limit,
          session: options?.session,
          type: options?.type,
        });

        if (results.length === 0) {
          info(`No results for "${query}"`);
          info('Try broader search terms or use --reindex to rebuild the index.');
          return;
        }

        console.log(colors.bold(`  Results for "${query}":`) + ` ${results.length} matches`);
        console.log('');

        let lastSession = '';
        for (const r of results) {
          if (r.sessionId !== lastSession) {
            lastSession = r.sessionId;
            console.log(colors.cyan(`  ${r.sessionId}`));
          }

          const ts = r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '';
          const typeColor = r.eventType === 'prompt' ? colors.green
            : r.eventType === 'command' ? colors.yellow
            : colors.dim;
          const typeLabel = typeColor(`[${r.eventType}]`);

          const snippet = r.snippet
            .replace(/<</g, '\x1b[1;4m')
            .replace(/>>/g, '\x1b[0m');

          console.log(`    ${colors.dim(ts)} ${typeLabel} ${snippet}`);
        }

        console.log('');
        if (results.length >= limit) {
          info(`Showing top ${limit} results. Use --limit to see more.`);
        }
      } finally {
        index.close();
      }
    });
}

const DB_FILENAME = 'search.db';
