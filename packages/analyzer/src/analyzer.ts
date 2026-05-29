import type { ExecutionGraph } from '@aifr/graph-builder';
import type { AIFREvent } from '@aifr/event-schema';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SessionAnalysis, AnalysisWarning } from './types.js';
import { ANALYSIS_SCHEMA_VERSION } from './constants.js';
import { calculateAttribution } from './attribution.js';
import { detectRetries } from './retry-detector.js';
import { generateSummary } from './summary.js';

export function analyzeSession(
  graph: ExecutionGraph,
  events: AIFREvent[],
  metadata: { agentType: string; durationMs?: number },
): SessionAnalysis {
  const attribution = calculateAttribution(graph);
  const { retryGroups, warnings: retryWarnings } = detectRetries(graph, events);
  const summary = generateSummary(graph, events, metadata);
  summary.retryCount = retryGroups.length;

  const allWarnings: AnalysisWarning[] = [
    ...retryWarnings,
    ...graph.warnings.map(w => ({ code: w.code, message: w.message })),
  ];

  if (summary.testsPassed === 0 && summary.testsFailed === 0) {
    allWarnings.push({ code: 'no_tests', message: 'No test events captured' });
  }
  if (attribution.unattributed > 0) {
    allWarnings.push({ code: 'unattributed_diffs', message: `${attribution.unattributed} diff(s) could not be attributed to any prompt` });
  }

  return {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    sessionId: graph.sessionId,
    generatedAt: Date.now(),
    attribution,
    retryGroups,
    summary,
    warnings: allWarnings,
  };
}

export async function analyzeFromDisk(sessionDir: string): Promise<SessionAnalysis> {
  const metadataRaw = await readFile(path.join(sessionDir, 'metadata.json'), 'utf8');
  const metadata = JSON.parse(metadataRaw);

  const graphRaw = await readFile(path.join(sessionDir, 'graph.json'), 'utf8');
  const graph: ExecutionGraph = JSON.parse(graphRaw);

  const eventsRaw = await readFile(path.join(sessionDir, 'events.jsonl'), 'utf8');
  const events: AIFREvent[] = eventsRaw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

  return analyzeSession(graph, events, {
    agentType: metadata.agentType ?? 'unknown',
    durationMs: metadata.durationMs,
  });
}
