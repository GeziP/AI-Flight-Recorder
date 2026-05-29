import { describe, it, expect } from 'vitest';
import { generateReport } from './report.js';
import type { ExecutionGraph } from '@aifr/graph-builder';
import type { SessionAnalysis } from './types.js';
import type { AIFREvent, PromptEvent, DiffEvent } from '@aifr/event-schema';

function makeGraph(): ExecutionGraph {
  return {
    schemaVersion: '0.2.0',
    sessionId: 'test_session',
    generatedAt: 1700000000000,
    nodes: [
      { id: 'node_0', type: 'prompt', eventIds: ['ep1'], label: 'fix the login bug', timestamp: 1000, metadata: { role: 'user' } },
      { id: 'node_1', type: 'command', eventIds: ['ec1'], label: 'npx vitest run', timestamp: 5000, metadata: {} },
      { id: 'node_2', type: 'diff', eventIds: ['ed1'], label: '2 files (+30/-5)', timestamp: 15000, metadata: { isBaseline: false } },
      { id: 'node_3', type: 'test', eventIds: ['et1'], label: 'test: pass', timestamp: 20000, metadata: { outcome: 'pass' } },
    ],
    edges: [
      { id: 'edge_0', from: 'node_0', to: 'node_1', type: 'caused_by', confidence: 'high', evidence: ['test'], source: 'inferred' },
      { id: 'edge_1', from: 'node_0', to: 'node_2', type: 'caused_by', confidence: 'high', evidence: ['chain'], source: 'inferred' },
      { id: 'edge_2', from: 'node_2', to: 'node_3', type: 'verified_by', confidence: 'high', evidence: ['test'], source: 'inferred' },
    ],
    warnings: [],
  };
}

function makeAnalysis(): SessionAnalysis {
  return {
    schemaVersion: '0.2.0',
    sessionId: 'test_session',
    generatedAt: 1700000000000,
    attribution: { totalDiffs: 1, attributed: 1, unattributed: 0, byConfidence: { high: 1, medium: 0, low: 0 } },
    retryGroups: [],
    summary: {
      agent: 'claude',
      duration: 19000,
      totalPrompts: 1,
      totalCommands: 1,
      totalDiffFiles: 2,
      totalAdditions: 30,
      totalDeletions: 5,
      testsPassed: 1,
      testsFailed: 0,
      retryCount: 0,
      hasBaselineDiff: false,
    },
    warnings: [],
  };
}

function makeEvents(): AIFREvent[] {
  return [
    { sessionId: 's', schemaVersion: '0.1.0', id: 'ep1', type: 'prompt', timestamp: 1000, content: 'fix the login bug in auth.ts', agentType: 'claude', role: 'user' } as PromptEvent,
    { sessionId: 's', schemaVersion: '0.1.0', id: 'ed1', type: 'diff', timestamp: 15000, files: [{ path: 'src/auth.ts', status: 'modified', additions: 20, deletions: 3 }, { path: 'tests/auth.test.ts', status: 'modified', additions: 10, deletions: 2 }], patch: 'p', totalAdditions: 30, totalDeletions: 5, isBaseline: false } as DiffEvent,
  ];
}

describe('generateReport', () => {
  it('generates markdown with all sections', () => {
    const report = generateReport(makeGraph(), makeAnalysis(), makeEvents());
    expect(report).toContain('# Session Review Report');
    expect(report).toContain('## Summary');
    expect(report).toContain('## Prompt-to-Diff Attribution');
    expect(report).toContain('## Execution Timeline');
  });

  it('includes session metadata in header', () => {
    const report = generateReport(makeGraph(), makeAnalysis(), makeEvents());
    expect(report).toContain('test_session');
    expect(report).toContain('claude');
    expect(report).toContain('19s');
  });

  it('shows summary table with correct values', () => {
    const report = generateReport(makeGraph(), makeAnalysis(), makeEvents());
    expect(report).toContain('| User Prompts | 1 |');
    expect(report).toContain('| Commands | 1 |');
    expect(report).toContain('| Files Changed | 2 |');
    expect(report).toContain('| Code Changes | +30 / -5 |');
    expect(report).toContain('| Tests Passed | 1 |');
  });

  it('shows attribution mappings', () => {
    const report = generateReport(makeGraph(), makeAnalysis(), makeEvents());
    expect(report).toContain('### Mappings');
    expect(report).toContain('fix the login bug in auth.ts');
    expect(report).toContain('2 files (+30/-5)');
    expect(report).toContain('high');
  });

  it('shows retry analysis when present', () => {
    const analysis = makeAnalysis();
    analysis.retryGroups = [{
      id: 'retry_0',
      failureNodeId: 'node_test_fail',
      fixNodeIds: ['node_diff_fix'],
      successNodeId: 'node_test_pass',
      hotspotFiles: ['src/auth.ts'],
    }];
    const report = generateReport(makeGraph(), analysis, makeEvents());
    expect(report).toContain('## Retry Analysis');
    expect(report).toContain('retry_0');
    expect(report).toContain('`src/auth.ts`');
  });

  it('shows warnings', () => {
    const analysis = makeAnalysis();
    analysis.warnings = [{ code: 'no_tests', message: 'No test events captured' }];
    const report = generateReport(makeGraph(), analysis, makeEvents());
    expect(report).toContain('## Warnings');
    expect(report).toContain('[no_tests]');
    expect(report).toContain('No test events captured');
  });

  it('truncates long prompt content', () => {
    const longContent = 'a'.repeat(300);
    const events: AIFREvent[] = [
      { sessionId: 's', schemaVersion: '0.1.0', id: 'ep1', type: 'prompt', timestamp: 1000, content: longContent, agentType: 'claude', role: 'user' } as PromptEvent,
    ];
    const report = generateReport(makeGraph(), makeAnalysis(), events);
    // Should be truncated in the mappings table
    expect(report).not.toContain(longContent);
  });

  it('respects maxTimelineEntries', () => {
    const graph = makeGraph();
    // Add many nodes
    for (let i = 4; i < 60; i++) {
      graph.nodes.push({ id: `node_${i}`, type: 'command', eventIds: [`e${i}`], label: `cmd ${i}`, timestamp: 1000 + i * 1000, metadata: {} });
    }
    const report = generateReport(graph, makeAnalysis(), makeEvents(), { maxTimelineEntries: 10 });
    const timelineLines = report.split('\n').filter(l => l.startsWith('| +'));
    expect(timelineLines.length).toBe(10);
  });
});
