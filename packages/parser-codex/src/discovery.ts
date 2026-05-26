import { readdir, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseCodexSession, type ParseResult } from './parser.js';

export interface DiscoveredSession {
  sessionFile: string;
  sessionId: string;
  lastModified: Date;
  cwd?: string;
}

/**
 * Get the Codex CLI sessions directory.
 */
export function getCodexSessionsDir(): string {
  return join(homedir(), '.codex', 'sessions');
}

/**
 * Discover all Codex CLI sessions on this machine.
 */
export async function discoverCodexSessions(): Promise<DiscoveredSession[]> {
  const sessionsDir = getCodexSessionsDir();
  const sessions: DiscoveredSession[] = [];

  async function walkDir(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const fileStat = await stat(fullPath);

      if (fileStat.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.endsWith('.jsonl')) {
        const sessionId = entry.replace(/\.jsonl$/, '');
        sessions.push({
          sessionFile: fullPath,
          sessionId,
          lastModified: fileStat.mtime,
        });
      }
    }
  }

  await walkDir(sessionsDir);
  return sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
}

/**
 * Import a Codex session by file path and convert to AIFR events.
 */
export async function importCodexSession(
  filePath: string,
  sessionId?: string
): Promise<ParseResult> {
  return parseCodexSession(filePath, sessionId);
}

/**
 * Import all Codex sessions and convert to AIFR events.
 */
export async function importAllCodexSessions(): Promise<ParseResult[]> {
  const sessions = await discoverCodexSessions();
  const results: ParseResult[] = [];

  for (const session of sessions) {
    const result = await importCodexSession(session.sessionFile);
    results.push(result);
  }

  return results;
}
