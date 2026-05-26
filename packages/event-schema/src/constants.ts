export const AIFR_EVENT_SCHEMA_VERSION = '0.1.0' as const;

export const EVENT_TYPES = [
  'session',
  'prompt',
  'command',
  'diff',
  'tool',
  'test',
  'terminal_output',
  'retry',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const AGENT_TYPES = ['claude', 'codex', 'cursor', 'unknown'] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const TEST_OUTCOMES = ['pass', 'fail', 'error', 'skip'] as const;
export type TestOutcome = (typeof TEST_OUTCOMES)[number];
