import { loadSessionData } from '@/lib/load-session-data';
import { GraphViewClient } from './client';

export const dynamic = 'force-dynamic';

export default async function GraphPage({
  params,
}: {
  params: Promise<{ project: string; session: string }>;
}) {
  const { project: rawProject, session: sessionName } = await params;
  const project = decodeURIComponent(rawProject);

  const data = await loadSessionData(project, sessionName, { graph: true });
  if (!data.sessionDir) {
    return <div className="flex-1 p-8 text-text-muted">Session not found.</div>;
  }

  return <GraphViewClient graph={data.graph as Record<string, unknown> | undefined} />;
}
