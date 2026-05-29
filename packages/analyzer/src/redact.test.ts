import { describe, it, expect } from 'vitest';
import { redactEvent, redactEvents, getDefaultRules } from './redact.js';
import type { RedactionRule } from './redact.js';
import type { AIFREvent, PromptEvent, CommandEvent, TerminalOutputEvent } from '@aifr/event-schema';

function prompt(id: string, content: string): PromptEvent {
  return { sessionId: 's', schemaVersion: '0.1.0', id, type: 'prompt', timestamp: 0, content, agentType: 'claude', role: 'user' };
}

function command(id: string, stdout: string, stderr?: string): CommandEvent {
  return { sessionId: 's', schemaVersion: '0.1.0', id, type: 'command', timestamp: 0, command: 'echo', cwd: '/tmp', exitCode: 0, status: 'completed', stdout, stderr };
}

function terminal(id: string, content: string): TerminalOutputEvent {
  return { sessionId: 's', schemaVersion: '0.1.0', id, type: 'terminal_output', timestamp: 0, stream: 'stdout', content, isChunk: false, sequenceNumber: 0 };
}

describe('redactEvent', () => {
  it('redacts AWS access key', () => {
    const evt = prompt('p1', 'my key is AKIAIOSFODNN7EXAMPLE');
    const { event, redactedCount } = redactEvent(evt);
    expect((event as PromptEvent).content).toBe('my key is [AWS_ACCESS_KEY]');
    expect(redactedCount).toBe(1);
  });

  it('redacts GitHub token', () => {
    const evt = prompt('p1', 'token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij');
    const { event, redactedCount } = redactEvent(evt);
    expect((event as PromptEvent).content).toContain('[GITHUB_TOKEN]');
    expect(redactedCount).toBe(1);
  });

  it('redacts email', () => {
    const evt = prompt('p1', 'contact user@example.com for details');
    const { event } = redactEvent(evt);
    expect((event as PromptEvent).content).toContain('[EMAIL]');
    expect((event as PromptEvent).content).not.toContain('user@example.com');
  });

  it('redacts JWT token', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc123def456';
    const evt = prompt('p1', `Authorization: Bearer ${jwt}`);
    const { event } = redactEvent(evt);
    expect((event as PromptEvent).content).toContain('[JWT_TOKEN]');
  });

  it('redacts password assignment', () => {
    const evt = prompt('p1', 'password=supersecret123');
    const { event } = redactEvent(evt);
    expect((event as PromptEvent).content).toContain('[PASSWORD]');
  });

  it('redacts command stdout/stderr', () => {
    const evt = command('c1', 'export AWS_KEY=AKIAIOSFODNN7EXAMPLE', 'error for admin@company.com');
    const { event } = redactEvent(evt);
    expect((event as CommandEvent).stdout).toContain('[AWS_ACCESS_KEY]');
    expect((event as CommandEvent).stderr).toContain('[EMAIL]');
  });

  it('redacts terminal output', () => {
    const evt = terminal('t1', 'connecting with admin@dev.io and AKIAIOSFODNN7EXAMPLE');
    const { event } = redactEvent(evt);
    const content = (event as TerminalOutputEvent).content;
    expect(content).toContain('[EMAIL]');
    expect(content).toContain('[AWS_ACCESS_KEY]');
  });

  it('preserves event when no secrets found', () => {
    const evt = prompt('p1', 'just a normal prompt about code');
    const { event, redactedCount } = redactEvent(evt);
    expect((event as PromptEvent).content).toBe('just a normal prompt about code');
    expect(redactedCount).toBe(0);
  });

  it('does not mutate original event', () => {
    const evt = prompt('p1', 'key is AKIAIOSFODNN7EXAMPLE');
    redactEvent(evt);
    expect(evt.content).toBe('key is AKIAIOSFODNN7EXAMPLE');
  });
});

describe('redactEvents', () => {
  it('processes multiple events', () => {
    const events: AIFREvent[] = [
      prompt('p1', 'key: AKIAIOSFODNN7EXAMPLE'),
      prompt('p2', 'clean content'),
      prompt('p3', 'email: test@test.com'),
    ];
    const result = redactEvents(events);
    expect(result.totalScanned).toBe(3);
    expect(result.totalRedacted).toBe(2);
    expect(result.events).toHaveLength(3);
    expect((result.events[0] as PromptEvent).content).toContain('[AWS_ACCESS_KEY]');
    expect((result.events[1] as PromptEvent).content).toBe('clean content');
  });

  it('aggregates matches by rule', () => {
    const events: AIFREvent[] = [
      prompt('p1', 'AKIAIOSFODNN7EXAMPLE and AKIA1234567890ABCDEF'),
      prompt('p2', 'admin@dev.io'),
    ];
    const result = redactEvents(events);
    expect(result.matchesByRule['aws_access_key']).toBe(2);
    expect(result.matchesByRule['email']).toBe(1);
  });
});

describe('custom rules', () => {
  it('applies custom redaction rules', () => {
    const customRules: RedactionRule[] = [
      { name: 'project_name', pattern: /ProjectAlpha/g, replacement: '[PROJECT]' },
    ];
    const evt = prompt('p1', 'Deploy ProjectAlpha to production');
    const { event } = redactEvent(evt, customRules);
    expect((event as PromptEvent).content).toBe('Deploy [PROJECT] to production');
  });
});

describe('getDefaultRules', () => {
  it('returns independent copies', () => {
    const rules1 = getDefaultRules();
    const rules2 = getDefaultRules();
    expect(rules1).not.toBe(rules2);
    expect(rules1.length).toBeGreaterThan(5);
  });
});
