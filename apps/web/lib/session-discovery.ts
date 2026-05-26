import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  agentType: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  gitRef: string;
  gitBranch?: string;
  status: string;
  eventCount?: number;
}

export interface DiscoveredSession {
  name: string;
  dir: string;
  metadata?: SessionMetadata;
}

export function extractSessionId(sessionDirName: string): string {
  const parts = sessionDirName.split('_');
  return parts.length >= 3 ? parts.slice(2).join('_') : sessionDirName;
}

export function formatSessionDate(sessionDirName: string): string {
  const match = sessionDirName.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
  if (!match) return sessionDirName;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[parseInt(match[2], 10) - 1];
  const day = parseInt(match[3], 10);
  const hour = match[4];
  const minute = match[5];
  return `${month} ${day}, ${hour}:${minute}`;
}

export async function discoverSessions(aifrDir: string): Promise<DiscoveredSession[]> {
  const sessionsDir = path.join(aifrDir, 'sessions');
  if (!existsSync(sessionsDir)) return [];

  const entries = await readdir(sessionsDir, { withFileTypes: true });
  const sessions: DiscoveredSession[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sessionDir = path.join(sessionsDir, entry.name);
    const metadataPath = path.join(sessionDir, 'metadata.json');
    let metadata: SessionMetadata | undefined;
    if (existsSync(metadataPath)) {
      try {
        const content = await readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(content) as SessionMetadata;
      } catch {}
    }
    sessions.push({ name: entry.name, dir: sessionDir, metadata });
  }

  sessions.sort((a, b) => b.name.localeCompare(a.name));
  return sessions;
}
