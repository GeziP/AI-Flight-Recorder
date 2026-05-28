import { describe, it, expect } from 'vitest';
import { calculateAttribution } from './attribution.js';
import type { ExecutionGraph } from '@aifr/graph-builder';

function makeGraph(diffCount: number, attributedCount: number, confidences: Array<'high' | 'medium' | 'low'> = []): ExecutionGraph {
  const nodes = [];
  const edges = [];
  for (let i = 0; i < diffCount; i++) {
    nodes.push({ id: `diff_${i}`, type: 'diff' as const, eventIds: [`e_diff_${i}`], label: `diff ${i}`, timestamp: i * 10000, metadata: { isBaseline: false } });
  }
  for (let i = 0; i < attributedCount; i++) {
    const conf = confidences[i] ?? 'high';
    edges.push({ id: `edge_${i}`, from: `prompt_${i}`, to: `diff_${i}`, type: 'caused_by' as const, confidence: conf, evidence: ['test'], source: 'inferred' as const });
  }
  nodes.push({ id: 'prompt_0', type: 'prompt' as const, eventIds: ['ep'], label: 'p', timestamp: 0, metadata: {} });

  return { schemaVersion: '0.1.0', sessionId: 'test', generatedAt: 0, nodes, edges, warnings: [] };
}

describe('calculateAttribution', () => {
  it('all diffs attributed', () => {
    const graph = makeGraph(3, 3, ['high', 'high', 'medium']);
    const result = calculateAttribution(graph);
    expect(result.totalDiffs).toBe(3);
    expect(result.attributed).toBe(3);
    expect(result.unattributed).toBe(0);
    expect(result.byConfidence.high).toBe(2);
    expect(result.byConfidence.medium).toBe(1);
  });

  it('mixed attribution', () => {
    const graph = makeGraph(4, 2, ['high', 'low']);
    const result = calculateAttribution(graph);
    expect(result.attributed).toBe(2);
    expect(result.unattributed).toBe(2);
    expect(result.byConfidence.low).toBe(1);
  });

  it('no attribution', () => {
    const graph = makeGraph(2, 0);
    const result = calculateAttribution(graph);
    expect(result.attributed).toBe(0);
    expect(result.unattributed).toBe(2);
  });

  it('skips baseline diffs', () => {
    const graph: ExecutionGraph = {
      schemaVersion: '0.1.0', sessionId: 'test', generatedAt: 0,
      nodes: [
        { id: 'd1', type: 'diff', eventIds: ['e1'], label: 'baseline', timestamp: 0, metadata: { isBaseline: true } },
        { id: 'd2', type: 'diff', eventIds: ['e2'], label: 'real', timestamp: 1000, metadata: { isBaseline: false } },
      ],
      edges: [], warnings: [],
    };
    const result = calculateAttribution(graph);
    expect(result.totalDiffs).toBe(1); // only non-baseline
  });
});
