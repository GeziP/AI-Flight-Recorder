import { discoverProjects, discoverSessions } from './session-discovery';

const projectCache = new Map<string, string>();
const sessionCache = new Map<string, string>();

/**
 * Resolve a project name to its .aifr directory.
 */
export async function resolveProjectDir(projectName: string): Promise<string | null> {
  if (projectCache.has(projectName)) return projectCache.get(projectName)!;
  const projects = await discoverProjects();
  const project = projects.find(p => p.name === projectName);
  if (project) {
    projectCache.set(projectName, project.dir);
    return project.dir;
  }
  return null;
}

/**
 * Resolve a project+session to the session directory path.
 */
export async function resolveSessionDir(projectName: string, sessionName: string): Promise<string | null> {
  const cacheKey = `${projectName}/${sessionName}`;
  if (sessionCache.has(cacheKey)) return sessionCache.get(cacheKey)!;
  const aifrDir = await resolveProjectDir(projectName);
  if (!aifrDir) return null;
  const sessions = await discoverSessions(aifrDir);
  const session = sessions.find(s => s.name === sessionName);
  if (session) {
    sessionCache.set(cacheKey, session.dir);
    return session.dir;
  }
  return null;
}
