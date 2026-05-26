import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MOCK_SESSIONS_DIR } from '@/lib/mock-data';
import { readEventsFile } from '@/lib/jsonl-reader';
import type { SessionEvent, PromptEvent, DiffEvent, TestEvent, RetryEvent } from '@aifr/event-schema';
import ReplayClient from './client';

// Event types that appear as markers on the progress bar
const MARKER_TYPES = new Set(['prompt', 'diff', 'test', 'retry']);

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ project: string; session: string }>;
}) {
  const { session } = await params;
  const sessionDir = path.join(MOCK_SESSIONS_DIR, session);

  // Read events
  const eventsResult = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
  const events = eventsResult.events;

  // Find session start and end events
  const startEvent = events.find(
    (e): e is SessionEvent => e.type === 'session' && 'subtype' in e && e.subtype === 'start',
  );
  const endEvent = events.find(
    (e): e is SessionEvent => e.type === 'session' && 'subtype' in e && e.subtype === 'end',
  );

  const startTime = startEvent?.timestamp ?? 0;
  const endTime = endEvent?.timestamp ?? 0;
  const sessionDuration = endTime > startTime ? endTime - startTime : 0;

  // Build event markers for progress bar
  const eventMarkers = events
    .filter((e) => MARKER_TYPES.has(e.type))
    .map((e) => ({
      position: e.timestamp - startTime,
      type: e.type,
    }))
    .filter((m) => m.position >= 0 && m.position <= sessionDuration);

  // Read terminal log
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
