import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Session } from '@aifr/core';
import type { AIFREvent } from '@aifr/event-schema';

export async function findAifrDir(): Promise<string | null> {
  return Session.findAifrDir(process.cwd());
}

export function listSessionDirs(aifrDir: string): string[] {
  const sessionsDir = path.join(aifrDir, 'sessions');
  if (!existsSync(sessionsDir)) return [];
  return readdirSync(sessionsDir).filter(d =>
    existsSync(path.join(sessionsDir, d, 'metadata.json')),
  );
}

export function resolveSessionDirs(aifrDir: string, sessionId?: string, all?: boolean): string[] {
  const sessionsDir = path.join(aifrDir, 'sessions');
  const dirs = listSessionDirs(aifrDir);

  if (all) return dirs.map(d => path.join(sessionsDir, d));

  if (sessionId) {
    const match = dirs.find(d => d.includes(sessionId));
    if (match) return [path.join(sessionsDir, match)];
    return [];
  }

  if (dirs.length === 0) return [];
  const latest = dirs.sort().at(-1)!;
  return [path.join(sessionsDir, latest)];
}

export function readEventsFromSession(sessionDir: string): AIFREvent[] {
  const eventsPath = path.join(sessionDir, 'events.jsonl');
  if (!existsSync(eventsPath)) return [];
  const raw = readFileSync(eventsPath, 'utf8');
  return raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

export function readMetadataFromSession(sessionDir: string): Record<string, unknown> {
  const metadataPath = path.join(sessionDir, 'metadata.json');
  return JSON.parse(readFileSync(metadataPath, 'utf8'));
}
