import { readEventsFile } from '@/lib/jsonl-reader';
import { resolveSessionDir } from '@/lib/project-resolver';
import path from 'node:path';
import EventsClient from './client';

export default async function EventsPage({ params }: { params: Promise<{ project: string; session: string }> }) {
  const { project, session } = await params;
  const sessionDir = await resolveSessionDir(project, session);
  if (!sessionDir) return <div className="p-8 text-text-muted">Session not found.</div>;
  const result = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
  return <EventsClient events={result.events} />;
}
