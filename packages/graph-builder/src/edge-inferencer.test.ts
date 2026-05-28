import { describe, it, expect } from 'vitest';
import { inferEdges } from './edge-inferencer.js';
import type { GraphNode, GraphEdge } from './types.js';

function node(id: string, type: GraphNode['type'], ts: number, extra: Record<string, unknown> = {}): GraphNode {
  return { id, type, eventIds: [id], label: `${type} ${id}`, timestamp: ts, metadata: extra };
}

describe('inferEdges', () => {
  const prompt1 = node('node_p1', 'prompt', 1000, { role: 'user' });
  const cmd1 = node('node_c1', 'command', 5000, { command: 'npx vitest run' });
  const diff1 = node('node_d1', 'diff', 10000, { isBaseline: false });
  const test1 = node('node_t1', 'test', 15000, { outcome: 'pass' });

  it('Rule 1: prompt -> command within 60s', () => {
    const { edges } = inferEdges([prompt1, cmd1]);
    const e = edges.find(e => e.type === 'caused_by' && e.from === 'node_p1' && e.to === 'node_c1');
    expect(e).toBeDefined();
    expect(e!.confidence).toBe('high'); // 4s < 10s
  });

  it('Rule 1: confidence medium beyond 10s', () => {
    const cmd15 = node('node_c15', 'command', 25000, { command: 'npm test' });
    const { edges } = inferEdges([prompt1, cmd15]);
    const e = edges.find(e => e.type === 'caused_by');
    expect(e).toBeDefined();
    expect(e!.confidence).toBe('medium');
  });

  it('Rule 2: command -> diff for file ops', () => {
    const { edges } = inferEdges([cmd1, diff1]);
    const e = edges.find(e => e.type === 'produced_patch');
    expect(e).toBeDefined();
    expect(e!.confidence).toBe('high');
  });

  it('Rule 2: no edge for non-file-op commands', () => {
    const cmdLs = node('node_ls', 'command', 5000, { command: 'ls -la' });
    const { edges } = inferEdges([cmdLs, diff1]);
    expect(edges.find(e => e.type === 'produced_patch')).toBeUndefined();
  });

  it('Rule 5: diff -> test within 60s', () => {
    const { edges } = inferEdges([diff1, test1]);
    const e = edges.find(e => e.type === 'verified_by');
    expect(e).toBeDefined();
  });

  it('Rule 6: test(fail) -> next prompt', () => {
    const testFail = node('node_tf', 'test', 15000, { outcome: 'fail' });
    const prompt2 = node('node_p2', 'prompt', 20000, { role: 'user' });
    const { edges } = inferEdges([testFail, prompt2]);
    const e = edges.find(e => e.type === 'failed_then_retry');
    expect(e).toBeDefined();
    expect(e!.from).toBe('node_tf');
  });

  it('Phase B: chain attribution prompt->cmd->diff', () => {
    const { edges } = inferEdges([prompt1, cmd1, diff1]);
    const chain = edges.find(e => e.type === 'caused_by' && e.from === 'node_p1' && e.to === 'node_d1');
    expect(chain).toBeDefined();
    expect(chain!.confidence).toBe('high');
  });

  it('Phase B: no chain if prompt in between', () => {
    const prompt2 = node('node_p2', 'prompt', 7000, { role: 'user' });
    const { edges } = inferEdges([prompt1, cmd1, prompt2, diff1]);
    // No chain from p1 to d1 (p2 blocks it)
    const fromP1 = edges.find(e => e.type === 'caused_by' && e.from === 'node_p1' && e.to === 'node_d1');
    expect(fromP1).toBeUndefined();
    // p2 may get a fallback edge to d1 since it's closest
    const fromP2 = edges.find(e => e.type === 'caused_by' && e.from === 'node_p2' && e.to === 'node_d1');
    expect(fromP2).toBeDefined();
    expect(fromP2!.confidence).toBe('low');
  });

  it('Phase C: fallback attribution for diff without command bridge', () => {
    const diffSolo = node('node_ds', 'diff', 30000, { isBaseline: false });
    const { edges } = inferEdges([prompt1, diffSolo]);
    const fallback = edges.find(e => e.type === 'caused_by' && e.to === 'node_ds');
    expect(fallback).toBeDefined();
    expect(fallback!.confidence).toBe('low');
  });

  it('Phase C: no fallback beyond 120s', () => {
    const diffFar = node('node_df', 'diff', 200000, { isBaseline: false });
    const { edges } = inferEdges([prompt1, diffFar]);
    expect(edges.find(e => e.type === 'caused_by')).toBeUndefined();
  });

  it('preserves manual edges', () => {
    const manualEdge: GraphEdge = {
      id: 'edge_manual', from: 'node_p1', to: 'node_d1',
      type: 'caused_by', confidence: 'high', evidence: ['user override'], source: 'manual',
    };
    const { edges } = inferEdges([prompt1, diff1], [manualEdge]);
    expect(edges.find(e => e.source === 'manual')).toBeDefined();
  });

  it('skips baseline diffs for attribution', () => {
    const baselineDiff = node('node_bd', 'diff', 5000, { isBaseline: true });
    const { edges } = inferEdges([prompt1, baselineDiff]);
    expect(edges.find(e => e.type === 'caused_by' && e.to === 'node_bd')).toBeUndefined();
  });
});
