import { describe, it, expect } from 'vitest';
import { generateSummary } from './summary.js';
import type { ExecutionGraph } from '@aifr/graph-builder';
import type { AIFREvent, DiffEvent, PromptEvent } from '@aifr/event-schema';

describe('generateSummary', () => {
  it('counts node types correctly', () => {
    const graph: ExecutionGraph = {
      schemaVersion: '0.1.0', sessionId: 'test', generatedAt: 0,
      nodes: [
        { id: 'p1', type: 'prompt', eventIds: ['ep1'], label: 'p', timestamp: 0, metadata: { role: 'user' } },
        { id: 'p2', type: 'prompt', eventIds: ['ep2'], label: 'p', timestamp: 1000, metadata: { role: 'assistant' } },
        { id: 'c1', type: 'command', eventIds: ['ec1'], label: 'c', timestamp: 2000, metadata: {} },
        { id: 'd1', type: 'diff', eventIds: ['ed1'], label: 'd', timestamp: 3000, metadata: { isBaseline: false } },
      ],
      edges: [], warnings: [],
    };

    const events: AIFREvent[] = [
      { sessionId: 's', schemaVersion: '0.1.0', id: 'ep1', type: 'prompt', timestamp: 0, content: 'hi', agentType: 'claude', role: 'user' } as PromptEvent,
      { sessionId: 's', schemaVersion: '0.1.0', id: 'ed1', type: 'diff', timestamp: 3000, files: [{ path: 'a.ts', status: 'modified', additions: 10, deletions: 5 }], patch: 'p', totalAdditions: 10, totalDeletions: 5, isBaseline: false } as DiffEvent,
    ];

    const summary = generateSummary(graph, events, { agentType: 'claude' });
    expect(summary.totalPrompts).toBe(1); // only user role
    expect(summary.totalCommands).toBe(1);
    expect(summary.totalDiffFiles).toBe(1);
    expect(summary.totalAdditions).toBe(10);
    expect(summary.totalDeletions).toBe(5);
  });

  it('hasBaselineDiff true when baseline present', () => {
    const graph: ExecutionGraph = {
      schemaVersion: '0.1.0', sessionId: 'test', generatedAt: 0,
      nodes: [{ id: 'd1', type: 'diff', eventIds: ['ed1'], label: 'd', timestamp: 0, metadata: { isBaseline: true } }],
      edges: [], warnings: [],
    };

    const events: AIFREvent[] = [
      { sessionId: 's', schemaVersion: '0.1.0', id: 'ed1', type: 'diff', timestamp: 0, files: [], patch: '', totalAdditions: 0, totalDeletions: 0, isBaseline: true } as DiffEvent,
    ];

    const summary = generateSummary(graph, events, { agentType: 'claude' });
    expect(summary.hasBaselineDiff).toBe(true);
  });

  it('hasBaselineDiff false when no baseline', () => {
    const graph: ExecutionGraph = {
      schemaVersion: '0.1.0', sessionId: 'test', generatedAt: 0,
      nodes: [{ id: 'd1', type: 'diff', eventIds: ['ed1'], label: 'd', timestamp: 0, metadata: { isBaseline: false } }],
      edges: [], warnings: [],
    };

    const events: AIFREvent[] = [
      { sessionId: 's', schemaVersion: '0.1.0', id: 'ed1', type: 'diff', timestamp: 0, files: [], patch: '', totalAdditions: 0, totalDeletions: 0, isBaseline: false } as DiffEvent,
    ];

    const summary = generateSummary(graph, events, { agentType: 'claude' });
    expect(summary.hasBaselineDiff).toBe(false);
  });
});
