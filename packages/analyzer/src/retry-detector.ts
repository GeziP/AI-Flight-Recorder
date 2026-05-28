import type { ExecutionGraph } from '@aifr/graph-builder';
import type { AIFREvent, DiffEvent, TestEvent } from '@aifr/event-schema';
import type { RetryGroup, AnalysisWarning } from './types.js';
import { RETRY_WINDOW_MS } from './constants.js';

export function detectRetries(graph: ExecutionGraph, events: AIFREvent[]): {
  retryGroups: RetryGroup[];
  warnings: AnalysisWarning[];
} {
  const warnings: AnalysisWarning[] = [];
  const groups: RetryGroup[] = [];
  let counter = 0;

  const failedTests = graph.nodes.filter(n => n.type === 'test' && (n.metadata.outcome === 'fail' || n.metadata.outcome === 'error'));

  for (const failure of failedTests) {
    const windowEnd = failure.timestamp + RETRY_WINDOW_MS;
    const fixNodes = graph.nodes.filter(n =>
      n.timestamp > failure.timestamp &&
      n.timestamp <= windowEnd &&
      (n.type === 'prompt' || n.type === 'command' || n.type === 'diff' || n.type === 'tool'),
    );

    if (fixNodes.length === 0) continue;

    const successTest = graph.nodes.find(n =>
      n.type === 'test' &&
      n.metadata.outcome === 'pass' &&
      n.timestamp > failure.timestamp &&
      n.timestamp <= windowEnd,
    );

    const hotspotFiles = computeHotspotFiles(failure, fixNodes, events);

    groups.push({
      id: `retry_${counter++}`,
      failureNodeId: failure.id,
      fixNodeIds: fixNodes.map(n => n.id),
      ...(successTest ? { successNodeId: successTest.id } : {}),
      hotspotFiles,
    });
  }

  return { retryGroups: groups, warnings };
}

function computeHotspotFiles(failure: { eventIds: string[] }, fixNodes: { eventIds: string[]; type: string }[], events: AIFREvent[]): string[] {
  const fileCounts = new Map<string, number>();

  const failureFiles = extractFilesFromEvents(failure.eventIds, events);
  for (const f of failureFiles) fileCounts.set(f, 1);

  for (const fixNode of fixNodes) {
    if (fixNode.type !== 'diff') continue;
    const files = extractFilesFromEvents(fixNode.eventIds, events);
    for (const f of files) {
      fileCounts.set(f, (fileCounts.get(f) ?? 0) + 1);
    }
  }

  return [...fileCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([file]) => file);
}

function extractFilesFromEvents(eventIds: string[], events: AIFREvent[]): string[] {
  const files: string[] = [];
  for (const eid of eventIds) {
    const ev = events.find(e => e.id === eid);
    if (ev?.type === 'diff') {
      const diff = ev as DiffEvent;
      for (const f of diff.files ?? []) files.push(f.path);
    }
    if (ev?.type === 'test') {
      const test = ev as TestEvent;
      for (const f of test.failures ?? []) {
        if (f.filePath) files.push(f.filePath);
      }
    }
  }
  return files;
}
