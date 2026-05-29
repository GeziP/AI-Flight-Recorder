import type { AIFREvent, PromptEvent, CommandEvent, DiffEvent, TestEvent, ToolEvent, TerminalOutputEvent, RetryEvent, SessionEvent } from '@aifr/event-schema';
import type { GraphNode, GraphNodeType, GraphWarning } from './types.js';
import { EVENT_TO_NODE_TYPE, TERMINAL_MERGE_WINDOW_MS } from './constants.js';

export function extractNodes(events: AIFREvent[]): {
  nodes: GraphNode[];
  warnings: GraphWarning[];
} {
  const warnings: GraphWarning[] = [];
  if (events.length === 0) return { nodes: [], warnings };

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const nodes: GraphNode[] = [];
  let nodeCounter = 0;

  let i = 0;
  while (i < sorted.length) {
    const event = sorted[i]!;

    if (!event.timestamp || event.timestamp <= 0) {
      warnings.push({ code: 'missing_timestamp', message: `Event ${event.id} missing timestamp, skipped`, eventId: event.id });
      i++;
      continue;
    }

    const nodeType = EVENT_TO_NODE_TYPE[event.type];
    if (!nodeType) {
      warnings.push({ code: 'unknown_event_type', message: `Unknown event type '${event.type}', mapped to tool`, eventId: event.id });
      nodes.push(makeNode(nodeCounter++, 'tool', [event], event.timestamp, undefined, { originalType: event.type }));
      i++;
      continue;
    }

    if (nodeType === 'terminal' && i + 1 < sorted.length) {
      const merged = tryMergeTerminal(sorted, i);
      if (merged.count > 1) {
        const mergedEvents = sorted.slice(i, i + merged.count);
        nodes.push(makeNode(
          nodeCounter++,
          'terminal',
          mergedEvents,
          mergedEvents[0]!.timestamp,
          mergedEvents[mergedEvents.length - 1]!.timestamp,
          { stream: (mergedEvents[0] as TerminalOutputEvent).stream, charCount: mergedEvents.reduce((s, e) => s + ((e as TerminalOutputEvent).content?.length ?? 0), 0), chunkCount: merged.count },
        ));
        i += merged.count;
        continue;
      }
    }

    nodes.push(makeNodeFromEvent(nodeCounter++, nodeType, event));
    i++;
  }

  return { nodes, warnings };
}

function tryMergeTerminal(events: AIFREvent[], startIdx: number): { count: number } {
  let count = 1;
  for (let j = startIdx + 1; j < events.length; j++) {
    const prev = events[j - 1]!;
    const curr = events[j]!;
    if (curr.type !== 'terminal_output') break;
    if (curr.timestamp - prev.timestamp > TERMINAL_MERGE_WINDOW_MS) break;
    count++;
  }
  return { count };
}

function makeNode(
  id: number,
  type: GraphNodeType,
  events: AIFREvent[],
  timestamp: number,
  timestampEnd: number | undefined,
  metadata: Record<string, unknown>,
): GraphNode {
  return {
    id: `node_${id}`,
    type,
    eventIds: events.map(e => e.id),
    label: generateLabel(type, events),
    timestamp,
    ...(timestampEnd != null && timestampEnd !== timestamp ? { timestampEnd } : {}),
    metadata,
  };
}

function makeNodeFromEvent(id: number, type: GraphNodeType, event: AIFREvent): GraphNode {
  return makeNode(id, type, [event], event.timestamp, undefined, extractMetadata(type, event));
}

function generateLabel(type: GraphNodeType, events: AIFREvent[]): string {
  const e = events[0]!;
  switch (type) {
    case 'prompt': {
      const p = e as PromptEvent;
      const content = p.content ?? '';
      return content.length > 80 ? content.slice(0, 77) + '...' : content;
    }
    case 'command': {
      const c = e as CommandEvent;
      return c.command ?? 'unknown command';
    }
    case 'diff': {
      const d = e as DiffEvent;
      const files = d.files?.length ?? 0;
      return `modified ${files} file${files !== 1 ? 's' : ''} (+${d.totalAdditions}/-${d.totalDeletions})`;
    }
    case 'test': {
      const t = e as TestEvent;
      return `test: ${t.outcome}`;
    }
    case 'tool': {
      const t = e as ToolEvent;
      return t.name ?? 'unknown tool';
    }
    case 'terminal': {
      const total = events.reduce((s, ev) => s + ((ev as TerminalOutputEvent).content?.length ?? 0), 0);
      return `terminal output (${total} chars)`;
    }
    case 'retry': {
      const r = e as RetryEvent;
      return `retry attempt #${r.attemptNumber}`;
    }
    case 'session': {
      const s = e as SessionEvent;
      return `session ${s.subtype}`;
    }
  }
}

function extractMetadata(type: GraphNodeType, event: AIFREvent): Record<string, unknown> {
  switch (type) {
    case 'prompt': {
      const p = event as PromptEvent;
      return { role: p.role, agentType: p.agentType, model: p.model };
    }
    case 'command': {
      const c = event as CommandEvent;
      return { command: c.command, exitCode: c.exitCode, status: c.status };
    }
    case 'diff': {
      const d = event as DiffEvent;
      return { isBaseline: d.isBaseline, fileCount: d.files?.length ?? 0, totalAdditions: d.totalAdditions, totalDeletions: d.totalDeletions, files: d.files?.map(f => f.path) ?? [] };
    }
    case 'test': {
      const t = event as TestEvent;
      return { outcome: t.outcome, framework: t.framework, passed: t.passed, failed: t.failed, totalTests: t.totalTests };
    }
    case 'tool': {
      const t = event as ToolEvent;
      return { name: t.name, agentType: t.agentType, status: t.status };
    }
    case 'terminal': {
      const t = event as TerminalOutputEvent;
      return { stream: t.stream };
    }
    case 'retry': {
      const r = event as RetryEvent;
      return { attemptNumber: r.attemptNumber, reason: r.reason };
    }
    case 'session': {
      const s = event as SessionEvent;
      return { subtype: s.subtype, ...(s.subtype === 'start' ? { agentType: s.agentType, projectPath: s.projectPath } : { status: (s as any).status }) };
    }
  }
}
