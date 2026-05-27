import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveSessionDir } from '@/lib/project-resolver';
import { readEventsFile } from '@/lib/jsonl-reader';
import type { AIFREvent, SessionEvent } from '@aifr/event-schema';
import ReplayClient from './client';

const MARKER_TYPES = new Set(['prompt', 'diff', 'test', 'retry']);

function buildEventLog(events: AIFREvent[]): string {
  const lines: string[] = [];
  for (const e of events) {
    const ts = new Date(e.timestamp).toLocaleTimeString();
    switch (e.type) {
      case 'prompt': {
        const role = 'role' in e ? (e as { role?: string }).role : '';
        const content = 'content' in e ? String((e as { content?: string }).content ?? '') : '';
        if (role === 'user') {
          lines.push(`[${ts}] > ${content.slice(0, 200)}`);
        } else if (role === 'assistant') {
          lines.push(`[${ts}] ${content.slice(0, 200)}`);
        }
        break;
      }
      case 'command': {
        const cmd = 'command' in e ? String((e as { command?: string }).command ?? '') : '';
        lines.push(`[${ts}] $ ${cmd}`);
        break;
      }
      case 'tool': {
        const name = 'toolName' in e ? String((e as { toolName?: string }).toolName ?? '') : 'tool';
        lines.push(`[${ts}] [tool] ${name}`);
        break;
      }
      case 'diff': {
        const files = 'files' in e ? (e as unknown as { files?: unknown[] }).files ?? [] : [];
        lines.push(`[${ts}] [diff] ${files.length} file(s) changed`);
        break;
      }
      case 'test': {
        const passed = 'passed' in e ? (e as { passed?: boolean }).passed : undefined;
        lines.push(`[${ts}] [test] ${passed === true ? 'PASS' : passed === false ? 'FAIL' : 'result'}`);
        break;
      }
      case 'retry': {
        lines.push(`[${ts}] [retry]`);
        break;
      }
      case 'session': {
        const sub = 'subtype' in e ? String((e as { subtype?: string }).subtype ?? '') : '';
        lines.push(`[${ts}] === session ${sub} ===`);
        break;
      }
    }
  }
  return lines.join('\n') + '\n';
}

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ project: string; session: string }>;
}) {
  const { project, session } = await params;
  const sessionDir = await resolveSessionDir(decodeURIComponent(project), session);
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
  const tsToActive = new Map<number, number>();
  let cumulative = 0;
  for (let i = 0; i < sortedTs.length; i++) {
    tsToActive.set(sortedTs[i], cumulative);
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
