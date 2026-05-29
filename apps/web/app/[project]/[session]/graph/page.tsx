import { loadSessionData } from '@/lib/load-session-data';
import { readEventsFile } from '@/lib/jsonl-reader';
import path from 'node:path';
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

  const eventsResult = await readEventsFile(path.join(data.sessionDir, 'events.jsonl'));

  return (
    <GraphViewClient
      graph={data.graph as Record<string, unknown> | undefined}
      events={eventsResult.events as Array<Record<string, unknown>>}
    />
  );
}
