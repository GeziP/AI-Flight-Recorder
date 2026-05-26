import { describe, it, expect } from 'vitest';
import { mapPromptToChanges } from '../prompt-mapping.js';
import type { AIFREvent } from '@aifr/event-schema';

const events: AIFREvent[] = [
  {
    id: 'p1',
    sessionId: 's1',
    type: 'prompt',
    timestamp: 100,
    schemaVersion: '0.1.0',
    content: 'First prompt',
    agentType: 'claude',
    role: 'user',
  },
  {
    id: 't1',
    sessionId: 's1',
    type: 'tool',
    timestamp: 200,
    schemaVersion: '0.1.0',
    name: 'Edit',
    agentType: 'claude',
    input: { file_path: 'a.ts' },
    status: 'success',
  },
  {
    id: 'd1',
    sessionId: 's1',
    type: 'diff',
    timestamp: 300,
    schemaVersion: '0.1.0',
    files: [{ path: 'a.ts', status: 'modified' as const, additions: 5, deletions: 2 }],
    totalAdditions: 5,
    totalDeletions: 2,
    isBaseline: false,
  },
  {
    id: 'p2',
    sessionId: 's1',
    type: 'prompt',
    timestamp: 400,
    schemaVersion: '0.1.0',
    content: 'Second prompt',
    agentType: 'claude',
    role: 'user',
  },
  {
    id: 't2',
    sessionId: 's1',
    type: 'tool',
    timestamp: 500,
    schemaVersion: '0.1.0',
    name: 'Edit',
    agentType: 'claude',
    input: { file_path: 'b.ts' },
    status: 'success',
  },
  {
    id: 'd2',
    sessionId: 's1',
    type: 'diff',
    timestamp: 600,
    schemaVersion: '0.1.0',
    files: [{ path: 'b.ts', status: 'added' as const, additions: 10, deletions: 0 }],
    totalAdditions: 10,
    totalDeletions: 0,
    isBaseline: false,
  },
];

describe('mapPromptToChanges', () => {
  it('finds diffs between two prompts', () => {
    const result = mapPromptToChanges(events, 'p1');
    expect(result.relatedDiffs).toHaveLength(1);
    expect(result.relatedDiffs[0].id).toBe('d1');
  });

  it('finds tools between prompts', () => {
    const result = mapPromptToChanges(events, 'p1');
    expect(result.executionPath).toHaveLength(2);
    expect(result.executionPath[0].id).toBe('t1');
  });

  it('handles last prompt', () => {
    const result = mapPromptToChanges(events, 'p2');
    expect(result.relatedDiffs).toHaveLength(1);
    expect(result.relatedDiffs[0].id).toBe('d2');
  });

  it('returns empty for non-existent prompt', () => {
    const result = mapPromptToChanges(events, 'nonexistent');
    expect(result.relatedDiffs).toHaveLength(0);
    expect(result.prompt).toBeNull();
    expect(result.executionPath).toHaveLength(0);
  });
});
