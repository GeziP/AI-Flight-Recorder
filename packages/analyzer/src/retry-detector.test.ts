import { describe, it, expect } from 'vitest';
import { detectRetries } from './retry-detector.js';
import type { ExecutionGraph, GraphNode } from '@aifr/graph-builder';
import type { AIFREvent, TestEvent, DiffEvent } from '@aifr/event-schema';

function makeTestEvent(id: string, ts: number, outcome: 'pass' | 'fail'): TestEvent {
  return { sessionId: 's', schemaVersion: '0.1.0', id, type: 'test', timestamp: ts, command: 'vitest', outcome, passed: outcome === 'pass' ? 1 : 0, failed: outcome === 'fail' ? 1 : 0, failures: outcome === 'fail' ? [{ testName: 'test1', message: 'failed' }] : undefined };
}

function makeDiffEvent(id: string, ts: number, files: string[]): DiffEvent {
  return { sessionId: 's', schemaVersion: '0.1.0', id, type: 'diff', timestamp: ts, files: files.map(f => ({ path: f, status: 'modified' as const, additions: 1, deletions: 1 })), patch: 'p', totalAdditions: files.length, totalDeletions: files.length, isBaseline: false };
}

describe('detectRetries', () => {
  it('detects retry after test failure within 300s', () => {
    const failNode: GraphNode = { id: 'test_fail', type: 'test', eventIds: ['tf'], label: 'fail', timestamp: 10000, metadata: { outcome: 'fail' } };
    const fixNode: GraphNode = { id: 'diff_fix', type: 'diff', eventIds: ['df'], label: 'fix', timestamp: 20000, metadata: { isBaseline: false } };
    const passNode: GraphNode = { id: 'test_pass', type: 'test', eventIds: ['tp'], label: 'pass', timestamp: 30000, metadata: { outcome: 'pass' } };

    const graph: ExecutionGraph = {
      schemaVersion: '0.1.0', sessionId: 'test', generatedAt: 0,
      nodes: [failNode, fixNode, passNode], edges: [], warnings: [],
    };

    const events: AIFREvent[] = [
      makeTestEvent('tf', 10000, 'fail'),
      makeDiffEvent('df', 20000, ['src/app.ts']),
      makeTestEvent('tp', 30000, 'pass'),
    ];

    const { retryGroups } = detectRetries(graph, events);
    expect(retryGroups).toHaveLength(1);
    expect(retryGroups[0]!.failureNodeId).toBe('test_fail');
    expect(retryGroups[0]!.successNodeId).toBe('test_pass');
    expect(retryGroups[0]!.fixNodeIds).toContain('diff_fix');
  });

  it('no retry beyond 300s window', () => {
    const failNode: GraphNode = { id: 'test_fail', type: 'test', eventIds: ['tf'], label: 'fail', timestamp: 10000, metadata: { outcome: 'fail' } };
    const fixNode: GraphNode = { id: 'diff_fix', type: 'diff', eventIds: ['df'], label: 'fix', timestamp: 400000, metadata: { isBaseline: false } };

    const graph: ExecutionGraph = {
      schemaVersion: '0.1.0', sessionId: 'test', generatedAt: 0,
      nodes: [failNode, fixNode], edges: [], warnings: [],
    };

    const { retryGroups } = detectRetries(graph, [makeTestEvent('tf', 10000, 'fail'), makeDiffEvent('df', 400000, ['f.ts'])]);
    expect(retryGroups).toHaveLength(0);
  });

  it('retry without eventual success', () => {
    const failNode: GraphNode = { id: 'test_fail', type: 'test', eventIds: ['tf'], label: 'fail', timestamp: 10000, metadata: { outcome: 'fail' } };
    const fixNode: GraphNode = { id: 'diff_fix', type: 'diff', eventIds: ['df'], label: 'fix', timestamp: 20000, metadata: { isBaseline: false } };

    const graph: ExecutionGraph = {
      schemaVersion: '0.1.0', sessionId: 'test', generatedAt: 0,
      nodes: [failNode, fixNode], edges: [], warnings: [],
    };

    const { retryGroups } = detectRetries(graph, [makeTestEvent('tf', 10000, 'fail'), makeDiffEvent('df', 20000, ['f.ts'])]);
    expect(retryGroups).toHaveLength(1);
    expect(retryGroups[0]!.successNodeId).toBeUndefined();
  });

  it('detects hotspot files', () => {
    const failNode: GraphNode = { id: 'test_fail', type: 'test', eventIds: ['tf'], label: 'fail', timestamp: 10000, metadata: { outcome: 'fail' } };
    const fixNode: GraphNode = { id: 'diff_fix', type: 'diff', eventIds: ['df'], label: 'fix', timestamp: 20000, metadata: { isBaseline: false } };

    const graph: ExecutionGraph = {
      schemaVersion: '0.1.0', sessionId: 'test', generatedAt: 0,
      nodes: [failNode, fixNode], edges: [], warnings: [],
    };

    const events: AIFREvent[] = [
      makeTestEvent('tf', 10000, 'fail'), // failure has filePath in failures
      makeDiffEvent('df', 20000, ['src/app.ts']),
    ];
    // Update test event to have filePath in failures
    (events[0] as TestEvent).failures = [{ testName: 't', filePath: 'src/app.ts', message: 'err' }];

    const { retryGroups } = detectRetries(graph, events);
    expect(retryGroups).toHaveLength(1);
    expect(retryGroups[0]!.hotspotFiles).toContain('src/app.ts');
  });
});
