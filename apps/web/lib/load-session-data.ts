import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { discoverProjects, discoverSessions } from './session-discovery';

export interface SessionDataOptions {
  graph?: boolean;
  analysis?: boolean;
  report?: boolean;
}

export async function resolveSessionDir(projectName: string, sessionName: string) {
  const projects = await discoverProjects();
  const projectInfo = projects.find(p => p.name === projectName);
  const aifrDir = projectInfo?.dir;
  if (!aifrDir) return null;

  const sessions = await discoverSessions(aifrDir);
  const sessionInfo = sessions.find(s => s.name === sessionName);
  return sessionInfo?.dir ?? null;
}

export async function loadSessionData(projectName: string, sessionName: string, options: SessionDataOptions = {}) {
  const sessionDir = await resolveSessionDir(projectName, sessionName);
  if (!sessionDir) return { sessionDir: null };

  const result: { sessionDir: string | null; graph?: Record<string, unknown>; analysis?: Record<string, unknown>; report?: string } = { sessionDir };

  if (options.graph) {
    const graphPath = path.join(sessionDir, 'graph.json');
    if (existsSync(graphPath)) {
      try {
        result.graph = JSON.parse(await readFile(graphPath, 'utf-8'));
      } catch {}
    }
  }

  if (options.analysis) {
    const analysisPath = path.join(sessionDir, 'analysis.json');
    if (existsSync(analysisPath)) {
      try {
        result.analysis = JSON.parse(await readFile(analysisPath, 'utf-8'));
      } catch {}
    }
  }

  if (options.report) {
    const reportPath = path.join(sessionDir, 'report.md');
    if (existsSync(reportPath)) {
      try {
        result.report = await readFile(reportPath, 'utf-8');
      } catch {}
    }
  }

  return result;
}
