import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionSearchIndex } from './search.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let index: SessionSearchIndex;

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `aifr-search-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = path.join(tmpDir, 'test.db');
  index = new SessionSearchIndex(dbPath);
});

afterEach(() => {
  index.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

function createSession(dirName: string, events: Record<string, unknown>[]): string {
  const sessionDir = path.join(tmpDir, dirName);
  mkdirSync(sessionDir, { recursive: true });

  const metadata = {
    sessionId: dirName,
    agentType: 'claude',
    importedAt: new Date().toISOString(),
  };
  writeFileSync(path.join(sessionDir, 'metadata.json'), JSON.stringify(metadata));

  const jsonl = events.map(e => JSON.stringify(e)).join('\n') + '\n';
  writeFileSync(path.join(sessionDir, 'events.jsonl'), jsonl);

  return sessionDir;
}

describe('SessionSearchIndex', () => {
  it('indexes a single session', () => {
    const dir = createSession('sess-1', [
      { id: 'e1', type: 'prompt', timestamp: 1000, content: 'Fix the authentication bug' },
      { id: 'e2', type: 'command', timestamp: 2000, command: 'npm test', stdout: '3 tests passed', stderr: '' },
      { id: 'e3', type: 'diff', timestamp: 3000, files: [{ path: 'src/auth.ts' }], patch: 'fix auth logic' },
    ]);

    const count = index.indexSession(dir);
    expect(count).toBe(3);
    expect(index.getSessionCount()).toBe(1);
    expect(index.getEventCount()).toBe(3);
  });

  it('searches by keyword', () => {
    const dir = createSession('sess-2', [
      { id: 'e1', type: 'prompt', timestamp: 1000, content: 'Fix the authentication bug in login' },
      { id: 'e2', type: 'prompt', timestamp: 2000, content: 'Refactor the database connection pool' },
      { id: 'e3', type: 'command', timestamp: 3000, command: 'git commit -m "fix authentication"' },
    ]);

    index.indexSession(dir);

    const results = index.search('authentication');
    expect(results.length).toBe(2);
    const types = results.map(r => r.eventType).sort();
    expect(types).toEqual(['command', 'prompt']);
  });

  it('filters by event type', () => {
    const dir = createSession('sess-3', [
      { id: 'e1', type: 'prompt', timestamp: 1000, content: 'Run the database migration' },
      { id: 'e2', type: 'command', timestamp: 2000, command: 'npm run migrate', stdout: 'migration done', stderr: '' },
    ]);

    index.indexSession(dir);

    const results = index.search('migration', { type: 'command' });
    expect(results.length).toBe(1);
    expect(results[0].eventType).toBe('command');
  });

  it('filters by session', () => {
    const dir1 = createSession('sess-a', [
      { id: 'e1', type: 'prompt', timestamp: 1000, content: 'Fix the error handling' },
    ]);
    const dir2 = createSession('sess-b', [
      { id: 'e2', type: 'prompt', timestamp: 2000, content: 'Fix the error handling in another project' },
    ]);

    index.indexSession(dir1);
    index.indexSession(dir2);

    const results = index.search('error', { session: 'sess-a' });
    expect(results.length).toBe(1);
    expect(results[0].sessionId).toBe('sess-a');
  });

  it('respects limit option', () => {
    const events = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`,
      type: 'prompt',
      timestamp: 1000 + i,
      content: 'Search for the keyword multiple times',
    }));
    const dir = createSession('sess-limit', events);

    index.indexSession(dir);

    const results = index.search('keyword', { limit: 5 });
    expect(results.length).toBe(5);
  });

  it('indexes all sessions in a directory', () => {
    createSession('batch-1', [
      { id: 'e1', type: 'prompt', timestamp: 1000, content: 'Hello world' },
    ]);
    createSession('batch-2', [
      { id: 'e2', type: 'prompt', timestamp: 2000, content: 'Goodbye world' },
    ]);

    const result = index.indexAll(tmpDir);
    expect(result.total).toBe(2);
    expect(result.indexed).toBe(2);
  });

  it('re-indexes a session', () => {
    const dir = createSession('sess-reindex', [
      { id: 'e1', type: 'prompt', timestamp: 1000, content: 'original content' },
    ]);

    index.indexSession(dir);
    expect(index.getEventCount()).toBe(1);

    // Re-create with different content
    createSession('sess-reindex', [
      { id: 'e1', type: 'prompt', timestamp: 1000, content: 'updated content' },
      { id: 'e2', type: 'prompt', timestamp: 2000, content: 'new event' },
    ]);

    const count = index.indexSession(dir);
    expect(count).toBe(2);
    expect(index.getSessionCount()).toBe(1);
  });

  it('handles empty sessions gracefully', () => {
    const dir = createSession('sess-empty', []);
    const count = index.indexSession(dir);
    expect(count).toBe(0);
  });

  it('skips session events', () => {
    const dir = createSession('sess-session', [
      { id: 'e1', type: 'session', timestamp: 1000, subtype: 'start' },
      { id: 'e2', type: 'prompt', timestamp: 2000, content: 'Real content' },
    ]);

    const count = index.indexSession(dir);
    expect(count).toBe(1);
  });

  it('searches diff file paths', () => {
    const dir = createSession('sess-diff', [
      {
        id: 'e1',
        type: 'diff',
        timestamp: 1000,
        files: [{ path: 'src/components/Button.tsx' }, { path: 'src/utils/helpers.ts' }],
        patch: '+const Button = () => {}',
      },
    ]);

    index.indexSession(dir);

    const results = index.search('Button.tsx');
    expect(results.length).toBe(1);
    expect(results[0].eventType).toBe('diff');
  });
});
