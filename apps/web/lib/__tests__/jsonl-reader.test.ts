import { describe, it, expect } from 'vitest';
import { parseJSONLContent } from '../jsonl-reader.js';

describe('parseJSONLContent', () => {
  it('parses valid JSONL lines into typed events', () => {
    const input = [
      JSON.stringify({
        id: 'evt_001', sessionId: 'sess_001', type: 'session', subtype: 'start',
        timestamp: 1716710400000, schemaVersion: '0.1.0', projectPath: '/test',
        agentType: 'claude', gitRef: 'abc1234', gitBranch: 'main',
        osPlatform: 'win32', osRelease: '10.0.26200', shell: 'bash', aifrVersion: '0.1.0',
      }),
      JSON.stringify({
        id: 'evt_010', sessionId: 'sess_001', type: 'prompt',
        timestamp: 1716710460000, schemaVersion: '0.1.0',
        content: 'Refactor scheduler', agentType: 'claude', role: 'user',
      }),
    ].join('\n');

    const { events } = parseJSONLContent(input);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('session');
    expect(events[1].type).toBe('prompt');
  });

  it('skips empty lines and comments', () => {
    const input = '# comment\n\n{"id":"evt_001","sessionId":"s1","type":"session","subtype":"start","timestamp":0,"schemaVersion":"0.1.0","projectPath":"/t","agentType":"claude","gitRef":"a","gitBranch":"m","osPlatform":"w","osRelease":"1","shell":"b","aifrVersion":"0.1.0"}\n\n';
    const { events } = parseJSONLContent(input);
    expect(events).toHaveLength(1);
  });

  it('collects parse errors instead of throwing', () => {
    const input = 'not-json\n{"id":"evt_001","sessionId":"s1","type":"session","subtype":"start","timestamp":0,"schemaVersion":"0.1.0","projectPath":"/t","agentType":"claude","gitRef":"a","gitBranch":"m","osPlatform":"w","osRelease":"1","shell":"b","aifrVersion":"0.1.0"}';
    const { events, errors } = parseJSONLContent(input);
    expect(events).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
  });
});
