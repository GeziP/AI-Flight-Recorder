import { discoverProjects, discoverSessions } from './session-discovery';

const projectCache = new Map<string, string>();
const sessionCache = new Map<string, string>();

// Match `..` as a path segment (delimited by / or \ or at string boundaries)
const PATH_TRAVERSAL = /(^|[\/\\])\.\.([\/\\]|$)/;

function safeDecode(raw: string): string | null {
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded || PATH_TRAVERSAL.test(decoded) || decoded.includes('\0')) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Resolve a URL-encoded project name to its .aifr directory.
 */
export async function resolveProjectDir(rawProjectName: string): Promise<string | null> {
  const projectName = safeDecode(rawProjectName);
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
  const projectName = safeDecode(rawProjectName);
  const sessionName = safeDecode(rawSessionName);
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
