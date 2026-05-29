import { Command } from 'commander';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Session } from '@aifr/core';
import { success, info, warn, error, header } from '../lib/output.js';

export function statusCommand(program: Command): Command {
  return program
    .command('status')
    .description('Check AIFR recording status and list sessions')
    .action(async () => {
      const cwd = process.cwd();

      header('AIFR Status');

      const aifrDir = await Session.findAifrDir(cwd);

      if (!aifrDir) {
        warn('AIFR is not initialized in this project.');
        info(`Run ${'\x1b[36maifr init\x1b[0m'} to start recording sessions.`);
        return;
      }

      success(`AIFR initialized at ${aifrDir}`);

      const sessionsDir = path.join(aifrDir, 'sessions');
      if (!existsSync(sessionsDir)) {
        info('No sessions recorded yet.');
        info(`Run ${'\x1b[36maifr start\x1b[0m'} to begin recording.`);
        return;
      }

      const sessions = readdirSync(sessionsDir).filter((d) => {
        return existsSync(path.join(sessionsDir, d, 'metadata.json'));
      });

      if (sessions.length === 0) {
        info('No sessions recorded yet.');
        info(`Run ${'\x1b[36maifr start\x1b[0m'} to begin recording.`);
        return;
      }

      info(`Found ${sessions.length} session(s):\n`);

      for (const sessionName of sessions) {
        try {
          const metadataPath = path.join(sessionsDir, sessionName, 'metadata.json');
          const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));

          const status: string = metadata.status ?? (metadata.importedAt ? 'imported' : 'unknown');
          const statusIcon = status === 'recording'
            ? '\x1b[33m●\x1b[0m'
            : status === 'completed' || status === 'imported'
              ? '\x1b[32m●\x1b[0m'
              : '\x1b[31m●\x1b[0m';

          const duration = metadata.durationMs
            ? `${(metadata.durationMs / 1000).toFixed(0)}s`
            : '...';

          console.log(`  ${statusIcon} ${sessionName}`);
          console.log(`    Status:  ${status}`);
          console.log(`    Agent:   ${metadata.agentType}`);
          console.log(`    Events:  ${metadata.eventCount ?? 0}`);
          console.log(`    Duration: ${duration}`);
          console.log('');
        } catch {
          warn(`  Could not read session: ${sessionName}`);
        }
      }
    });
}
