import Database from 'better-sqlite3';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { AIFREvent } from '@aifr/event-schema';

export interface CursorGeneration {
  unixMs: number;
  generationUUID: string;
  type: 'composer' | 'chat' | 'inline' | string;
  textDescription: string;
}

export interface CursorComposerHeader {
  composerId: string;
  name?: string;
  createdAt: number;
  lastUpdatedAt: number;
  unifiedMode?: string;
  totalLinesAdded?: number;
  totalLinesRemoved?: number;
  filesChangedCount?: number;
  isArchived?: boolean;
  subtitle?: string;
  isDraft?: boolean;
}

export interface CursorSession {
  sessionId: string;
  workspaceName: string;
  workspaceDir: string;
  dbPath: string;
  generations: CursorGeneration[];
  composerHeaders: Map<string, CursorComposerHeader>;
}

export interface ImportResult {
  sessionId: string;
  sourceSessionId: string;
  sourceFile: string;
  events: AIFREvent[];
  errors: string[];
}

function getCursorDataDir(): string {
  const platform = os.platform();
  if (platform === 'win32') {
    return path.join(process.env.APPDATA ?? '', 'Cursor', 'User');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User');
  } else {
    return path.join(os.homedir(), '.config', 'Cursor', 'User');
  }
}

function getWorkspaceMap(globalStorageDir: string): Map<string, string> {
  const map = new Map<string, string>();
  const workspaceStorageDir = path.join(globalStorageDir, 'workspaceStorage');
  if (!existsSync(workspaceStorageDir)) return map;

  for (const dir of readdirSync(workspaceStorageDir)) {
    const wsFile = path.join(workspaceStorageDir, dir, 'workspace.json');
    if (!existsSync(wsFile)) continue;
    try {
      const content = JSON.parse(readFileSync(wsFile, 'utf8'));
      const folder = content.folder as string;
      if (folder) {
        const folderPath = folder.replace(/^file:\/\//, '').replace(/%3A/g, ':').replace(/\//g, path.sep);
        map.set(dir, folderPath);
      }
    } catch { /* skip */ }
  }
  return map;
}

export function discoverCursorSessions(): CursorSession[] {
  const dataDir = getCursorDataDir();
  const globalStorageDir = path.join(dataDir, 'globalStorage');
  const workspaceStorageDir = path.join(dataDir, 'workspaceStorage');
  const sessions: CursorSession[] = [];

  if (!existsSync(workspaceStorageDir)) return sessions;

  const workspaceMap = getWorkspaceMap(globalStorageDir);

  for (const wsDir of readdirSync(workspaceStorageDir)) {
    const dbPath = path.join(workspaceStorageDir, wsDir, 'state.vscdb');
    if (!existsSync(dbPath)) continue;

    try {
      const db = new Database(dbPath, { readonly: true });
      const row = db.prepare("SELECT value FROM ItemTable WHERE key = 'aiService.generations'").get() as { value: Buffer } | undefined;

      if (row) {
        const generations: CursorGeneration[] = JSON.parse(row.value.toString());
        if (generations.length > 0) {
          const workspacePath = workspaceMap.get(wsDir) ?? wsDir;
          const workspaceName = path.basename(workspacePath);

          sessions.push({
            sessionId: wsDir,
            workspaceName,
            workspaceDir: workspacePath,
            dbPath,
            generations,
            composerHeaders: new Map(),
          });
        }
      }

      db.close();
    } catch { /* skip unreadable databases */ }
  }

  // Load composer headers from global storage
  const globalDbPath = path.join(globalStorageDir, 'state.vscdb');
  if (existsSync(globalDbPath)) {
    try {
      const globalDb = new Database(globalDbPath, { readonly: true });
      const headersRow = globalDb.prepare("SELECT value FROM ItemTable WHERE key = 'composer.composerHeaders'").get() as { value: Buffer } | undefined;

      if (headersRow) {
        const headersData = JSON.parse(headersRow.value.toString());
        const allComposers = headersData.allComposers as Record<string, CursorComposerHeader>;

        for (const session of sessions) {
          for (const [, header] of Object.entries(allComposers)) {
            if (header.composerId && !header.isDraft) {
              session.composerHeaders.set(header.composerId, header);
            }
          }
        }
      }

      globalDb.close();
    } catch { /* skip */ }
  }

  return sessions.sort((a, b) => {
    const aLast = a.generations[a.generations.length - 1]?.unixMs ?? 0;
    const bLast = b.generations[b.generations.length - 1]?.unixMs ?? 0;
    return bLast - aLast;
  });
}

export function importCursorSession(session: CursorSession): ImportResult {
  const sessionId = `cursor-${session.sessionId}`;
  const errors: string[] = [];
  const events: AIFREvent[] = [];

  // Session start event
  const firstTs = session.generations[0]?.unixMs ?? Date.now();
  events.push({
    id: `session-start-${sessionId}`,
    sessionId,
    type: 'session',
    subtype: 'start',
    timestamp: firstTs,
    schemaVersion: '0.1.0',
    projectPath: session.workspaceDir,
    agentType: 'cursor',
    gitRef: 'imported',
    gitBranch: 'unknown',
    osPlatform: os.platform(),
    osRelease: os.release(),
    shell: 'unknown',
    aifrVersion: '0.2.0',
    metadata: {
      sourceWorkspaceId: session.sessionId,
      workspaceName: session.workspaceName,
    },
  });

  // Convert generations to prompt events
  for (const gen of session.generations) {
    try {
      events.push({
        id: gen.generationUUID,
        sessionId,
        type: 'prompt',
        timestamp: gen.unixMs,
        schemaVersion: '0.1.0',
        content: gen.textDescription,
        agentType: 'cursor',
        role: 'user',
      });
    } catch (e) {
      errors.push(`Failed to parse generation ${gen.generationUUID}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Session end event
  const lastTs = session.generations[session.generations.length - 1]?.unixMs ?? Date.now();
  const durationMs = lastTs - firstTs;
  events.push({
    id: `session-end-${sessionId}`,
    sessionId,
    type: 'session',
    subtype: 'end',
    timestamp: lastTs,
    schemaVersion: '0.1.0',
    status: 'completed',
    durationMs,
    eventCount: events.length,
    gitRef: 'imported',
  });

  return {
    sessionId,
    sourceSessionId: session.sessionId,
    sourceFile: session.dbPath,
    events,
    errors,
  };
}
