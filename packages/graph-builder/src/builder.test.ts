import { describe, it, expect } from 'vitest';
import { buildGraph } from './builder.js';
import type { AIFREvent, PromptEvent, CommandEvent, DiffEvent, TestEvent } from '@aifr/event-schema';
import type { GraphEdge } from './types.js';

const BASE = { sessionId: 'test', schemaVersion: '0.1.0' };

function prompt(id: string, ts: number, content = 'fix bug'): PromptEvent {
  return { ...BASE, id, type: 'prompt', timestamp: ts, content, agentType: 'claude', role: 'user' };
}

function command(id: string, ts: number, cmd = 'npx vitest'): CommandEvent {
  return { ...BASE, id, type: 'command', timestamp: ts, command: cmd, cwd: '/tmp', exitCode: 0, status: 'completed' };
}

function diff(id: string, ts: number, isBaseline = false): DiffEvent {
  return {
    ...BASE, id, type: 'diff', timestamp: ts,
    files: [{ path: 'src/app.ts', status: 'modified', additions: 10, deletions: 5 }],
    patch: 'patch', totalAdditions: 10, totalDeletions: 5, isBaseline,
  };
}

function test_(id: string, ts: number, outcome: 'pass' | 'fail' = 'pass'): TestEvent {
  return { ...BASE, id, type: 'test', timestamp: ts, command: 'vitest', outcome, passed: outcome === 'pass' ? 1 : 0, failed: outcome === 'fail' ? 1 : 0 };
}

describe('buildGraph', () => {
  it('builds complete graph from realistic event sequence', () => {
    const events: AIFREvent[] = [
      prompt('p1', 1000),
      command('c1', 5000, 'pnpm test'),
      diff('d1', 15000),
      test_('t1', 20000, 'pass'),
    ];
    const graph = buildGraph(events, { sessionId: 'sess1' });

    expect(graph.sessionId).toBe('sess1');
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges.length).toBeGreaterThan(0);

    // Should have chain: p1 -> c1 -> d1 -> t1
    const causedBy = graph.edges.filter(e => e.type === 'caused_by');
    expect(causedBy.length).toBeGreaterThanOrEqual(2); // p1->c1 and p1->d1 (chain)

    const verified = graph.edges.find(e => e.type === 'verified_by');
    expect(verified).toBeDefined();
  });

  it('preserves manual edges on rebuild', () => {
    const events: AIFREvent[] = [prompt('p1', 1000), diff('d1', 5000)];
    const manualEdge: GraphEdge = {
      id: 'edge_manual', from: 'node_0', to: 'node_1',
      type: 'caused_by', confidence: 'high', evidence: ['user'], source: 'manual',
    };

    const graph = buildGraph(events, { sessionId: 's1', existingEdges: [manualEdge] });
    const manual = graph.edges.find(e => e.source === 'manual');
    expect(manual).toBeDefined();
    expect(manual!.evidence).toEqual(['user']);
  });

  it('handles empty events gracefully', () => {
    const graph = buildGraph([], { sessionId: 'empty' });
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  it('generates correct schema version', () => {
    const graph = buildGraph([prompt('p1', 1000)], { sessionId: 's1' });
    expect(graph.schemaVersion).toBe('0.1.0');
    expect(graph.generatedAt).toBeGreaterThan(0);
  });
});
