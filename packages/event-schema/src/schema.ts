import { z } from 'zod';
import { AIFR_EVENT_SCHEMA_VERSION, AGENT_TYPES, TEST_OUTCOMES, EVENT_TYPES } from './constants.js';

// ---- Base Schema ----

export const baseEventSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  timestamp: z.number().positive(),
  schemaVersion: z.literal(AIFR_EVENT_SCHEMA_VERSION),
});

// ---- SessionEvent Schemas ----

export const sessionStartSchema = baseEventSchema.extend({
  type: z.literal('session'),
  subtype: z.literal('start'),
  projectPath: z.string().min(1),
  agentType: z.enum(AGENT_TYPES),
  gitRef: z.string().min(1),
  gitBranch: z.string().min(1),
  osPlatform: z.string().min(1),
  osRelease: z.string().min(1),
  shell: z.string().min(1),
  aifrVersion: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const sessionEndSchema = baseEventSchema.extend({
  type: z.literal('session'),
  subtype: z.literal('end'),
  status: z.enum(['completed', 'aborted', 'error']),
  durationMs: z.number().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  gitRef: z.string().min(1),
  errorMessage: z.string().optional(),
});

export const sessionEventSchema = z.discriminatedUnion('subtype', [
  sessionStartSchema,
  sessionEndSchema,
]);

// ---- PromptEvent Schema ----

export const promptEventSchema = baseEventSchema.extend({
  type: z.literal('prompt'),
  content: z.string(),
  agentType: z.enum(AGENT_TYPES),
  model: z.string().optional(),
  tokenCount: z.number().int().positive().optional(),
  role: z.enum(['user', 'assistant']),
  attachments: z.array(
    z.object({
      type: z.enum(['file', 'image', 'url']),
      path: z.string().optional(),
      url: z.string().url().optional(),
      description: z.string().optional(),
    })
  ).optional(),
});

// ---- CommandEvent Schema ----

export const commandEventSchema = baseEventSchema.extend({
  type: z.literal('command'),
  command: z.string().min(1),
  cwd: z.string().min(1),
  exitCode: z.number().int().optional(),
  durationMs: z.number().nonnegative().optional(),
  status: z.enum(['running', 'completed', 'failed', 'interrupted']),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
});

// ---- DiffEvent Schema ----

export const diffFileChangeSchema = z.object({
  path: z.string().min(1),
  status: z.enum(['added', 'modified', 'deleted', 'renamed']),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  previousPath: z.string().optional(),
});

export const diffEventSchema = baseEventSchema.extend({
  type: z.literal('diff'),
  files: z.array(diffFileChangeSchema),
  patch: z.string().optional(),
  totalAdditions: z.number().int().nonnegative(),
  totalDeletions: z.number().int().nonnegative(),
  isBaseline: z.boolean(),
  snapshotLabel: z.string().optional(),
});

// ---- ToolEvent Schema ----

export const toolEventSchema = baseEventSchema.extend({
  type: z.literal('tool'),
  name: z.string().min(1),
  agentType: z.enum(AGENT_TYPES),
  input: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()).optional(),
  durationMs: z.number().nonnegative().optional(),
  status: z.enum(['success', 'error', 'interrupted']),
  errorMessage: z.string().optional(),
});

// ---- TestEvent Schema ----

export const testEventSchema = baseEventSchema.extend({
  type: z.literal('test'),
  framework: z.string().optional(),
  command: z.string().min(1),
  outcome: z.enum(TEST_OUTCOMES),
  totalTests: z.number().int().nonnegative().optional(),
  passed: z.number().int().nonnegative().optional(),
  failed: z.number().int().nonnegative().optional(),
  skipped: z.number().int().nonnegative().optional(),
  durationMs: z.number().nonnegative().optional(),
  failures: z.array(
    z.object({
      testName: z.string().min(1),
      filePath: z.string().optional(),
      message: z.string(),
      stackTrace: z.string().optional(),
    })
  ).optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
});

// ---- TerminalOutputEvent Schema ----

export const terminalOutputEventSchema = baseEventSchema.extend({
  type: z.literal('terminal_output'),
  stream: z.enum(['stdout', 'stderr']),
  content: z.string(),
  isChunk: z.boolean(),
  sequenceNumber: z.number().int().nonnegative(),
});

// ---- RetryEvent Schema ----

export const retryEventSchema = baseEventSchema.extend({
  type: z.literal('retry'),
  attemptNumber: z.number().int().positive(),
  maxAttempts: z.number().int().positive().optional(),
  reason: z.string().min(1),
  originalEventId: z.string().optional(),
  retryTarget: z.string().optional(),
});

// ---- Top-Level Discriminated Union ----

const sessionStartFullSchema = sessionStartSchema;
const sessionEndFullSchema = sessionEndSchema;

export const eventSchema = z.discriminatedUnion('type', [
  sessionStartFullSchema,
  sessionEndFullSchema,
  promptEventSchema,
  commandEventSchema,
  diffEventSchema,
  toolEventSchema,
  testEventSchema,
  terminalOutputEventSchema,
  retryEventSchema,
]);

// ---- Type Inference ----

export type AIFREvent = z.infer<typeof eventSchema>;
