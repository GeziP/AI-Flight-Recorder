import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveSessionDir } from '@/lib/project-resolver';
import { readEventsFile } from '@/lib/jsonl-reader';
import { buildEventLog } from '@/lib/event-log-builder';
import type { AIFREvent, SessionEvent } from '@aifr/event-schema';
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

  // Compute active duration: sum of gaps between consecutive events,
  // capping individual gaps at MAX_GAP to skip long idle periods.
  const MAX_GAP = 3 * 60 * 1000; // 3 minutes — compress longer idle periods
  const sortedTs = events.map((e) => e.timestamp).sort((a, b) => a - b);
  let activeDuration = sortedTs.length > 0 ? 1000 : 0; // small buffer for first event
  for (let i = 1; i < sortedTs.length; i++) {
    activeDuration += Math.min(sortedTs[i] - sortedTs[i - 1], MAX_GAP);
  }

  // Build a mapping from raw timestamp to active timeline position
  // (use first occurrence for duplicate timestamps)
  const tsToActive = new Map<number, number>();
  let cumulative = 0;
  for (let i = 0; i < sortedTs.length; i++) {
    if (!tsToActive.has(sortedTs[i])) {
      tsToActive.set(sortedTs[i], cumulative);
    }
    if (i < sortedTs.length - 1) {
      cumulative += Math.min(sortedTs[i + 1] - sortedTs[i], MAX_GAP);
    }
  }

  const eventMarkers = events
    .filter((e) => MARKER_TYPES.has(e.type))
    .map((e) => ({
      position: tsToActive.get(e.timestamp) ?? 0,
      type: e.type,
    }))
    .filter((m) => m.position >= 0 && m.position <= activeDuration);

  let terminalLog = '';
  try {
    terminalLog = await readFile(path.join(sessionDir, 'terminal.log'), 'utf-8');
  } catch {
    terminalLog = '';
  }

  // Build event log on server — avoids serializing large events array to client
  const eventLog = terminalLog || buildEventLog(events);

  return (
    <ReplayClient
      terminalLog={eventLog}
      sessionDuration={activeDuration}
      eventMarkers={eventMarkers}
    />
  );
}
