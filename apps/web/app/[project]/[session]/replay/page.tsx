import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveSessionDir } from '@/lib/project-resolver';
import { readEventsFile } from '@/lib/jsonl-reader';
import type { SessionEvent } from '@aifr/event-schema';
import ReplayClient from './client';

const MARKER_TYPES = new Set(['prompt', 'diff', 'test', 'retry']);

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ project: string; session: string }>;
}) {
  const { project, session } = await params;
  const sessionDir = await resolveSessionDir(project, session);
  if (!sessionDir) return <div className="p-8 text-text-muted">Session not found.</div>;

  const eventsResult = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
  const events = eventsResult.events;

  const startEvent = events.find(
    (e): e is SessionEvent => e.type === 'session' && 'subtype' in e && e.subtype === 'start',
  );
  const endEvent = events.find(
    (e): e is SessionEvent => e.type === 'session' && 'subtype' in e && e.subtype === 'end',
  );

  const startTime = startEvent?.timestamp ?? 0;
  const endTime = endEvent?.timestamp ?? 0;
  const sessionDuration = endTime > startTime ? endTime - startTime : 0;

  const eventMarkers = events
    .filter((e) => MARKER_TYPES.has(e.type))
    .map((e) => ({
      position: e.timestamp - startTime,
      type: e.type,
    }))
    .filter((m) => m.position >= 0 && m.position <= sessionDuration);

  let terminalLog = '';
  try {
    terminalLog = await readFile(path.join(sessionDir, 'terminal.log'), 'utf-8');
  } catch {
    terminalLog = '';
  }

  return (
    <ReplayClient
      terminalLog={terminalLog}
      sessionDuration={sessionDuration}
      eventMarkers={eventMarkers}
    />
  );
}
