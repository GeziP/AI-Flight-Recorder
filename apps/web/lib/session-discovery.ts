import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

export interface SessionMetadata {
  sessionId: string;
  projectPath?: string;
  agentType: string;
  startTime?: number;
  endTime?: number;
  durationMs?: number;
  gitRef?: string;
  gitBranch?: string;
  status?: string;
  eventCount?: number;
  sourceSessionId?: string;
  sourceFile?: string;
  importedAt?: string;
}

export interface DiscoveredSession {
  name: string;
  dir: string;
  metadata?: SessionMetadata;
}

export interface DiscoveredProject {
  name: string;
  dir: string;
  sessionCount: number;
  lastModified?: Date;
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

/**
 * Discover all projects that have .aifr directories.
 * Scans common development directories and the current working directory.
 */
export async function discoverProjects(): Promise<DiscoveredProject[]> {
  const projects: DiscoveredProject[] = [];
  const seenDirs = new Set<string>();

  // Try to find git root from cwd
  let gitRoot: string | null = null;
  try {
    gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim() || null;
  } catch {
    // Not in a git repo, ignore
  }

  // Search paths to scan for .aifr directories
  const searchPaths = [
    process.cwd(),
    ...(gitRoot && path.resolve(gitRoot) !== path.resolve(process.cwd()) ? [gitRoot] : []),
    homedir(),
    path.join(homedir(), 'projects'),
    path.join(homedir(), 'code'),
    path.join(homedir(), 'dev'),
    path.join(homedir(), 'src'),
    // Common Windows paths
    'D:\\gezi',
    'E:\\gezi',
  ];

  for (const searchPath of searchPaths) {
    if (!existsSync(searchPath)) continue;

    try {
      // Check if searchPath itself has .aifr
      const resolvedSearch = path.resolve(searchPath);
      const aifrDir = path.join(searchPath, '.aifr');
      if (existsSync(aifrDir) && !seenDirs.has(resolvedSearch)) {
        seenDirs.add(resolvedSearch);
        const sessions = await discoverSessions(aifrDir);
        if (sessions.length > 0) {
          projects.push({
            name: path.basename(searchPath),
            dir: aifrDir,
            sessionCount: sessions.length,
            lastModified: sessions[0]?.metadata?.startTime
              ? new Date(sessions[0].metadata.startTime)
              : undefined,
          });
        }
      }

      // Scan subdirectories
      let entries;
      try {
        entries = await readdir(searchPath, { withFileTypes: true });
      } catch { continue; }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const subDir = path.join(searchPath, entry.name);
        const resolvedSub = path.resolve(subDir);
        const aifrSubDir = path.join(subDir, '.aifr');
        if (existsSync(aifrSubDir) && !seenDirs.has(resolvedSub)) {
          seenDirs.add(resolvedSub);
          const sessions = await discoverSessions(aifrSubDir);
          if (sessions.length > 0) {
            projects.push({
              name: entry.name,
              dir: aifrSubDir,
              sessionCount: sessions.length,
              lastModified: sessions[0]?.metadata?.startTime
                ? new Date(sessions[0].metadata.startTime)
                : undefined,
            });
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  return projects.sort((a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0));
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

/**
 * Find a project's .aifr directory by project name.
 */
export async function findProjectDir(projectName: string): Promise<string | null> {
  const projects = await discoverProjects();
  const project = projects.find(p => p.name === projectName);
  return project?.dir ?? null;
}
