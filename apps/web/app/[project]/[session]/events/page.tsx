import { readEventsFile } from '@/lib/jsonl-reader';
import { MOCK_SESSIONS_DIR } from '@/lib/mock-data';
import path from 'node:path';
import EventsClient from './client';

export default async function EventsPage({ params }: { params: Promise<{ project: string; session: string }> }) {
  const { session } = await params;
  const result = await readEventsFile(path.join(MOCK_SESSIONS_DIR, session, 'events.jsonl'));
  return <EventsClient events={result.events} />;
}
