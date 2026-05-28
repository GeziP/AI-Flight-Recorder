import type { GraphNodeType } from './types.js';

export const GRAPH_SCHEMA_VERSION = '0.1.0';

export const EVENT_TO_NODE_TYPE: Record<string, GraphNodeType> = {
  session: 'session',
  prompt: 'prompt',
  command: 'command',
  diff: 'diff',
  test: 'test',
  tool: 'tool',
  terminal_output: 'terminal',
  retry: 'retry',
};

export const COMMAND_AFTER_PROMPT_MS = 60_000;
export const DIFF_AFTER_COMMAND_MS = 30_000;
export const TEST_AFTER_DIFF_MS = 60_000;
export const FALLBACK_PROMPT_DIFF_MS = 120_000;
export const HIGH_CONFIDENCE_THRESHOLD_MS = 10_000;
export const TERMINAL_MERGE_WINDOW_MS = 2_000;

export const FILE_OP_KEYWORDS = [
  'grep', 'sed', 'awk', 'write', 'edit', 'cat', 'touch',
  'mv', 'cp', 'rm', 'patch', 'apply', 'mkdir', 'npm',
  'npx', 'pnpm', 'yarn', 'cargo', 'go', 'python', 'node',
  'tsc', 'eslint', 'prettier', 'vitest', 'jest',
];
