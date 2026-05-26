import { readEventsFile } from '@/lib/jsonl-reader';
import { discoverSessions, formatSessionDate } from '@/lib/session-discovery';
import { MOCK_SESSIONS_DIR } from '@/lib/mock-data';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TimelineView } from '@/components/timeline/timeline-view';

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ project: string; session: string }>;
}) {
  const { session } = await params;
  const sessionDir = path.join(MOCK_SESSIONS_DIR, session);
  const eventsResult = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
  const events = eventsResult.events;

  let metadata: { agentType: string; gitBranch: string; eventCount: number; durationMs?: number } | undefined;
  try {
    const content = await readFile(path.join(sessionDir, 'metadata.json'), 'utf-8');
    const meta = JSON.parse(content);
    metadata = {
      agentType: meta.agentType,
      gitBranch: meta.gitBranch ?? 'unknown',
      eventCount: meta.eventCount ?? events.length,
      durationMs: meta.durationMs,
    };
  } catch {}

  return (
    <TimelineView
      events={events}
      sessionName={formatSessionDate(session)}
      metadata={metadata}
    />
  );
}
