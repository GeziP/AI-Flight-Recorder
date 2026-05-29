import { describe, it, expect } from 'vitest';
import { extractNodes } from './node-extractor.js';
import type { AIFREvent, PromptEvent, CommandEvent, DiffEvent, TestEvent, ToolEvent, TerminalOutputEvent, SessionStartEvent } from '@aifr/event-schema';

const BASE = { sessionId: 'test', schemaVersion: '0.1.0' };

function prompt(id: string, content: string, ts: number, role: 'user' | 'assistant' = 'user'): PromptEvent {
  return { ...BASE, id, type: 'prompt', timestamp: ts, content, agentType: 'claude', role };
}

function command(id: string, cmd: string, ts: number, exitCode = 0): CommandEvent {
  return { ...BASE, id, type: 'command', timestamp: ts, command: cmd, cwd: '/tmp', exitCode, status: 'completed' };
}

function diff(id: string, ts: number, files: number = 1, isBaseline = false): DiffEvent {
  return {
    ...BASE, id, type: 'diff', timestamp: ts,
    files: Array.from({ length: files }, (_, i) => ({ path: `file${i}.ts`, status: 'modified' as const, additions: 10, deletions: 5 })),
    patch: 'patch content', totalAdditions: files * 10, totalDeletions: files * 5, isBaseline,
  };
}

function test_(id: string, ts: number, outcome: 'pass' | 'fail' = 'pass'): TestEvent {
  return { ...BASE, id, type: 'test', timestamp: ts, command: 'vitest', outcome, passed: outcome === 'pass' ? 1 : 0, failed: outcome === 'fail' ? 1 : 0 };
}

function tool(id: string, name: string, ts: number): ToolEvent {
  return { ...BASE, id, type: 'tool', timestamp: ts, name, agentType: 'claude', input: {}, status: 'success' };
}

function terminal(id: string, content: string, ts: number): TerminalOutputEvent {
  return { ...BASE, id, type: 'terminal_output', timestamp: ts, stream: 'stdout', content, isChunk: true, sequenceNumber: 0 };
}

function sessionStart(id: string, ts: number): SessionStartEvent {
  return { ...BASE, id, type: 'session', timestamp: ts, subtype: 'start', projectPath: '/tmp', agentType: 'claude', gitRef: 'abc', gitBranch: 'main', osPlatform: 'linux', osRelease: '6.1', shell: 'bash', aifrVersion: '0.1.0' };
}

describe('extractNodes', () => {
  it('maps events to correct node types', () => {
    const events: AIFREvent[] = [
      sessionStart('s1', 1000),
      prompt('p1', 'hello', 2000),
      command('c1', 'ls', 3000),
      tool('t1', 'Read', 4000),
      diff('d1', 5000),
      test_('test1', 6000),
    ];
    const { nodes } = extractNodes(events);
    expect(nodes).toHaveLength(6);
    expect(nodes.map(n => n.type)).toEqual(['session', 'prompt', 'command', 'tool', 'diff', 'test']);
  });

  it('generates sequential node IDs', () => {
    const { nodes } = extractNodes([prompt('p1', 'a', 1000), command('c1', 'ls', 2000)]);
    expect(nodes[0]!.id).toBe('node_0');
    expect(nodes[1]!.id).toBe('node_1');
  });

  it('truncates prompt labels to 80 chars', () => {
    const longContent = 'a'.repeat(100);
    const { nodes } = extractNodes([prompt('p1', longContent, 1000)]);
    expect(nodes[0]!.label.length).toBeLessThanOrEqual(83); // 77 + '...'
  });

  it('merges consecutive terminal_output within 2s', () => {
    const events = [terminal('t1', 'abc', 1000), terminal('t2', 'def', 1500), terminal('t3', 'ghi', 4000)];
    const { nodes } = extractNodes(events);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]!.eventIds).toEqual(['t1', 't2']);
    expect(nodes[0]!.timestampEnd).toBe(1500);
    expect(nodes[1]!.eventIds).toEqual(['t3']);
  });

  it('does not merge terminal_output beyond 2s', () => {
    const events = [terminal('t1', 'abc', 1000), terminal('t2', 'def', 5000)];
    const { nodes } = extractNodes(events);
    expect(nodes).toHaveLength(2);
  });

  it('skips events with missing timestamps and warns', () => {
    const badEvent = { ...BASE, id: 'bad', type: 'prompt', timestamp: 0, content: 'x', agentType: 'claude', role: 'user' as const };
    const { nodes, warnings } = extractNodes([badEvent, prompt('p1', 'ok', 1000)]);
    expect(nodes).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.code).toBe('missing_timestamp');
  });

  it('handles unknown event type as tool fallback', () => {
    const unknownEvent = { ...BASE, id: 'unk', type: 'custom_type', timestamp: 1000 } as AIFREvent;
    const { nodes, warnings } = extractNodes([unknownEvent]);
    expect(nodes[0]!.type).toBe('tool');
    expect(nodes[0]!.metadata.originalType).toBe('custom_type');
    expect(warnings[0]!.code).toBe('unknown_event_type');
  });

  it('returns empty nodes for empty events', () => {
    const { nodes, warnings } = extractNodes([]);
    expect(nodes).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('sorts events by timestamp', () => {
    const events = [command('c1', 'ls', 3000), prompt('p1', 'hi', 1000), diff('d1', 2000)];
    const { nodes } = extractNodes(events);
    expect(nodes.map(n => n.type)).toEqual(['prompt', 'diff', 'command']);
  });

  it('extracts diff metadata with files list', () => {
    const { nodes } = extractNodes([diff('d1', 1000, 3)]);
    expect(nodes[0]!.metadata.fileCount).toBe(3);
    expect(nodes[0]!.metadata.totalAdditions).toBe(30);
  });
});
