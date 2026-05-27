import { discoverProjects, discoverSessions } from './session-discovery';

const projectCache = new Map<string, string>();
const sessionCache = new Map<string, string>();

const UNSAFE = /\.\.|[\0]/;

/**
 * Validate that a name segment doesn't contain path traversal characters.
 * Defense-in-depth: the resolver also uses whitelist matching,
 * but explicit rejection prevents future regressions if code changes to path concatenation.
 */
function assertSafeSegment(name: string, label: string): string | null {
  if (!name || UNSAFE.test(name)) return null;
  return name;
}

/**
 * Resolve a URL-encoded project name to its .aifr directory.
 */
export async function resolveProjectDir(rawProjectName: string): Promise<string | null> {
  const projectName = assertSafeSegment(decodeURIComponent(rawProjectName), 'project');
  if (!projectName) return null;

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
 * Resolve URL-encoded project+session to the session directory path.
 */
export async function resolveSessionDir(rawProjectName: string, rawSessionName: string): Promise<string | null> {
  const projectName = assertSafeSegment(decodeURIComponent(rawProjectName), 'project');
  const sessionName = assertSafeSegment(decodeURIComponent(rawSessionName), 'session');
  if (!projectName || !sessionName) return null;

  const cacheKey = `${projectName}/${sessionName}`;
  if (sessionCache.has(cacheKey)) return sessionCache.get(cacheKey)!;
  const aifrDir = await resolveProjectDir(rawProjectName);
  if (!aifrDir) return null;
  const sessions = await discoverSessions(aifrDir);
  const session = sessions.find(s => s.name === sessionName);
  if (session) {
    sessionCache.set(cacheKey, session.dir);
    return session.dir;
  }
  return null;
}

/**
 * Clear all caches. Useful in dev mode for hot reload.
 */
export function clearCache(): void {
  projectCache.clear();
  sessionCache.clear();
}
