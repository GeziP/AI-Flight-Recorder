import type { ExecutionGraph } from '@aifr/graph-builder';
import type { AIFREvent, DiffEvent, PromptEvent } from '@aifr/event-schema';
import type { SessionSummary } from './types.js';

export function generateSummary(
  graph: ExecutionGraph,
  events: AIFREvent[],
  metadata: { agentType: string; durationMs?: number },
): SessionSummary {
  const userPrompts = graph.nodes.filter(n => n.type === 'prompt' && n.metadata.role === 'user');
  const commands = graph.nodes.filter(n => n.type === 'command');

  const nonBaselineDiffEvents = events.filter(e =>
    e.type === 'diff' && !(e as DiffEvent).isBaseline,
  ) as DiffEvent[];

  const totalDiffFiles = nonBaselineDiffEvents.reduce((s, d) => s + (d.files?.length ?? 0), 0);
  const totalAdditions = nonBaselineDiffEvents.reduce((s, d) => s + d.totalAdditions, 0);
  const totalDeletions = nonBaselineDiffEvents.reduce((s, d) => s + d.totalDeletions, 0);

  const testNodes = graph.nodes.filter(n => n.type === 'test');
  const testsPassed = testNodes.filter(n => n.metadata.outcome === 'pass').length;
  const testsFailed = testNodes.filter(n => n.metadata.outcome === 'fail' || n.metadata.outcome === 'error').length;

  const hasBaselineDiff = events.some(e => e.type === 'diff' && (e as DiffEvent).isBaseline === true);

  return {
    agent: metadata.agentType ?? 'unknown',
    duration: metadata.durationMs ?? 0,
    totalPrompts: userPrompts.length,
    totalCommands: commands.length,
    totalDiffFiles,
    totalAdditions,
    totalDeletions,
    testsPassed,
    testsFailed,
    retryCount: 0,
    hasBaselineDiff,
  };
}
