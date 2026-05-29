import { Command } from 'commander';
import { findAifrDir, resolveSessionDirs, readEventsFromSession } from '../lib/session-utils.js';
import { success, warn, error, header, info } from '../lib/output.js';
import type { AIFREvent } from '@aifr/event-schema';

const colors = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

interface TerminalChunk {
  timestamp: number;
  sequenceNumber: number;
  content: string;
  stream: 'stdout' | 'stderr';
}

function extractTerminalChunks(events: AIFREvent[]): TerminalChunk[] {
  return events
    .filter((e): e is AIFREvent & { type: 'terminal_output' } => e.type === 'terminal_output')
    .map(e => ({
      timestamp: (e as Record<string, unknown>).timestamp as number,
      sequenceNumber: (e as Record<string, unknown>).sequenceNumber as number,
      content: (e as Record<string, unknown>).content as string,
      stream: (e as Record<string, unknown>).stream as 'stdout' | 'stderr',
    }))
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function replayCommand(program: Command): Command {
  return program
    .command('replay [session-id]')
    .description('Replay terminal output from a session')
    .option('--all', 'Not supported (replays latest session)')
    .option('--speed <factor>', 'Playback speed multiplier', '1')
    .option('--no-timing', 'Dump output without delays')
    .option('--chunks', 'Show chunk boundaries during replay')
    .action(async (sessionId?: string, options?: { all?: boolean; speed?: string; timing?: boolean; chunks?: boolean }) => {
      header('AIFR Replay');

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

      const events = readEventsFromSession(sessionDir);
      if (events.length === 0) {
        error(`No events found for session ${sessionName}`);
        return;
      }

      const chunks = extractTerminalChunks(events);
      if (chunks.length === 0) {
        info(`No terminal output events in session ${sessionName}.`);
        info('Terminal recording is only available for sessions recorded with "aifr start".');
        return;
      }

      const speed = Math.max(0.1, parseFloat(options?.speed ?? '1') || 1);
      const noTiming = options?.timing === false;

      info(`Replaying ${chunks.length} terminal chunks from ${sessionName} (${speed}x speed)`);
      console.log(colors.dim('─'.repeat(50)));

      if (noTiming) {
        for (const chunk of chunks) {
          process.stdout.write(chunk.content);
        }
      } else {
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];

          if (options?.chunks && i > 0) {
            process.stdout.write(`\x1b[90m[${chunk.stream} #${chunk.sequenceNumber}]\x1b[0m`);
          }

          process.stdout.write(chunk.content);

          if (i < chunks.length - 1) {
            const nextChunk = chunks[i + 1];
            const delayMs = (nextChunk.timestamp - chunk.timestamp) / speed;
            if (delayMs > 0 && delayMs < 10000) {
              await sleep(delayMs);
            }
          }
        }
      }

      console.log(colors.dim('─'.repeat(50)));
      success(`Replayed ${chunks.length} chunks`);
    });
}
