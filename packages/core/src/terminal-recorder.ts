import { type IPty, spawn } from 'node-pty';
import { createWriteStream, type WriteStream } from 'node:fs';
import path from 'node:path';
import { Session, type SessionInfo } from './session.js';
import { generateEventId, AIFR_EVENT_SCHEMA_VERSION, type TerminalOutputEvent } from '@aifr/event-schema';

const CHUNK_SIZE = 4096;

export interface TerminalRecorderOptions {
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
  logDir: string;
  session: Session;
}

/**
 * Manages a PTY session that records terminal output.
 * Spawns an interactive shell, forwards I/O, and records everything.
 */
export class TerminalRecorder {
  private pty: IPty | null = null;
  private logStream: WriteStream | null = null;
  private sequenceNumber = 0;
  private buffer = '';
  private bufferFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private isStopping = false;
  private resolveExited: ((value: number) => void) | null = null;

  constructor(private options: TerminalRecorderOptions) {}

  get sessionInfo(): SessionInfo {
    return this.options.session.info;
  }

  /**
   * Start the PTY session. Blocks until the shell exits.
   */
  async run(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.resolveExited = resolve;

      try {
        this.pty = spawn(this.options.shell, [], {
          name: 'xterm-256color',
          cols: this.options.cols,
          rows: this.options.rows,
          cwd: this.options.cwd,
          env: process.env as Record<string, string>,
        });
      } catch (err) {
        reject(new Error(`Failed to spawn shell: ${err instanceof Error ? err.message : String(err)}`));
        return;
      }

      // Open log file
      this.logStream = createWriteStream(
        path.join(this.options.logDir, 'terminal.log'),
        { flags: 'a', encoding: 'utf8' }
      );

      // Forward PTY output to stdout and record
      this.pty.onData((data: string) => {
        process.stdout.write(data);
        this.logStream?.write(data);
        this.bufferDataForEvent(data);
      });

      // Forward stdin to PTY
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', (data: Buffer) => {
        if (this.pty) {
          this.pty.write(data.toString());
        }
      });

      // Handle exit
      this.pty.onExit(({ exitCode, signal }) => {
        this.stop().then(() => {
          resolve(exitCode ?? signal ?? 1);
        }).catch(reject);
      });
    });
  }

  /**
   * Buffer terminal output and flush periodically as events.
   */
  private bufferDataForEvent(data: string): void {
    this.buffer += data;

    // Flush buffer if it exceeds chunk size
    if (this.buffer.length >= CHUNK_SIZE) {
      this.flushBuffer();
    } else if (!this.bufferFlushTimer) {
      // Set a short timer to flush (coalesce rapid output)
      this.bufferFlushTimer = setTimeout(() => {
        this.flushBuffer();
      }, 200);
    }
  }

  /**
   * Flush buffered terminal output as a TerminalOutputEvent.
   */
  private flushBuffer(): void {
    if (this.bufferFlushTimer) {
      clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }

    if (this.buffer.length === 0) return;

    const content = this.buffer;
    this.buffer = '';

    const event: TerminalOutputEvent = {
      id: generateEventId(),
      sessionId: this.sessionInfo.sessionId,
      type: 'terminal_output',
      timestamp: Date.now(),
      schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
      stream: 'stdout',
      content,
      isChunk: false,
      sequenceNumber: this.sequenceNumber++,
    };

    // Fire and forget - don't block terminal output on event writing
    this.options.session.appendEvent(event).catch(() => {
      // Silently ignore event write failures
    });
  }

  /**
   * Stop the PTY session.
   */
  async stop(): Promise<void> {
    if (this.isStopping) return;
    this.isStopping = true;

    // Flush remaining buffer
    this.flushBuffer();

    // Kill PTY if still running
    if (this.pty) {
      try {
        this.pty.kill();
      } catch {
        // PTY already exited
      }
      this.pty = null;
    }

    // Close log stream
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }

    // Restore stdin
    if (process.stdin.isRaw) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  }
}

/**
 * Detect the user's default shell.
 */
export function detectShell(): string {
  if (process.platform === 'win32') {
    return process.env.PWSSHELL
      ? process.env.PWSSHELL!
      : (process.env.COMSPEC || 'powershell.exe');
  }
  return process.env.SHELL || '/bin/bash';
}

/**
 * Get terminal dimensions.
 */
export function getTerminalSize(): { cols: number; rows: number } {
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  return { cols, rows };
}
