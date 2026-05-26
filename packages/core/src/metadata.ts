import { readFile, writeFile } from 'node:fs/promises';
import type { AgentType } from '@aifr/event-schema';

export interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  agentType: AgentType;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  gitRef: string;
  gitBranch?: string;
  status: 'recording' | 'completed' | 'aborted' | 'error';
  eventCount?: number;
}

export async function writeMetadata(filePath: string, metadata: SessionMetadata): Promise<void> {
  await writeFile(filePath, JSON.stringify(metadata, null, 2), 'utf8');
}

export async function readMetadata(filePath: string): Promise<SessionMetadata> {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content) as SessionMetadata;
}
