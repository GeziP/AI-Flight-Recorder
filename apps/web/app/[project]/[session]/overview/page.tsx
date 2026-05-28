import { loadSessionData } from '@/lib/load-session-data';
import { readEventsFile } from '@/lib/jsonl-reader';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { OverviewClient } from './client';

export const dynamic = 'force-dynamic';

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ project: string; session: string }>;
}) {
  const { project: rawProject, session: sessionName } = await params;
  const project = decodeURIComponent(rawProject);

  const data = await loadSessionData(project, sessionName, { analysis: true });
  if (!data.sessionDir) {
    return <div className="flex-1 p-8 text-text-muted">Session not found.</div>;
  }

  const sessionDir: string = data.sessionDir;
  const eventsResult = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
  const events = eventsResult.events;

  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(await readFile(path.join(sessionDir, 'metadata.json'), 'utf-8'));
  } catch {}

  return (
    <OverviewClient
      analysis={data.analysis}
      eventCount={events.length}
      metadata={metadata}
    />
  );
}
