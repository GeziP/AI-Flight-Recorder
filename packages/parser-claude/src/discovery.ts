import { readdir, stat, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { parseClaudeSession, type ParseResult } from './parser.js';

export interface DiscoveredSession {
  projectDir: string;
  projectName: string;
  sessionFile: string;
  sessionId: string;
  lastModified: Date;
}

/**
 * Get the Claude Code projects directory.
 */
export function getClaudeProjectsDir(): string {
  return join(homedir(), '.claude', 'projects');
}

/**
 * Discover all Claude Code sessions on this machine.
 */
export async function discoverClaudeSessions(): Promise<DiscoveredSession[]> {
  const projectsDir = getClaudeProjectsDir();
  const sessions: DiscoveredSession[] = [];

  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return [];
  }

  for (const projectDir of projectDirs) {
    const projectPath = join(projectsDir, projectDir);
    const projectStat = await stat(projectPath);
    if (!projectStat.isDirectory()) continue;

    let files: string[];
    try {
      files = await readdir(projectPath);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const filePath = join(projectPath, file);
      const fileStat = await stat(filePath);

      // Session ID is the filename without extension
      const sessionId = file.replace(/\.jsonl$/, '');

      sessions.push({
        projectDir: projectPath,
        projectName: projectDir,
        sessionFile: filePath,
        sessionId,
        lastModified: fileStat.mtime,
      });
    }
  }

  return sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
}

/**
 * Find Claude sessions for a specific project path.
 * Claude encodes the project path in the directory name (e.g., E--gezi-AI-Flight-Recorder).
 */
export async function findClaudeSessionsForProject(
  projectPath: string
): Promise<DiscoveredSession[]> {
  const allSessions = await discoverClaudeSessions();
  const normalizedPath = projectPath
    .replace(/[/\\]/g, '-')
    .replace(/^-/, '');

  return allSessions.filter(s =>
    s.projectName === normalizedPath ||
    s.projectName === projectPath.replace(/[/\\]+/g, '-')
  );
}

/**
 * Import a Claude session by file path and convert to AIFR events.
 */
export async function importClaudeSession(
  filePath: string,
  sessionId?: string
): Promise<ParseResult> {
  return parseClaudeSession(filePath, { sessionId });
}

/**
 * Import all Claude sessions for a project and convert to AIFR events.
 */
export async function importClaudeSessionsForProject(
  projectPath: string
): Promise<ParseResult[]> {
  const sessions = await findClaudeSessionsForProject(projectPath);
  const results: ParseResult[] = [];

  for (const session of sessions) {
    const result = await importClaudeSession(session.sessionFile);
    results.push(result);
  }

  return results;
}
