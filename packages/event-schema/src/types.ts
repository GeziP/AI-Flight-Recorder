import type { EventType, AgentType, TestOutcome } from './constants.js';

// ---- Base Event ----

export interface BaseEvent<T extends EventType> {
  id: string;
  sessionId: string;
  type: T;
  timestamp: number;
  schemaVersion: string;
}

// ---- SessionEvent ----

export interface SessionStartEvent extends BaseEvent<'session'> {
  subtype: 'start';
  projectPath: string;
  agentType: AgentType;
  gitRef: string;
  gitBranch: string;
  osPlatform: string;
  osRelease: string;
  shell: string;
  aifrVersion: string;
  metadata?: Record<string, unknown>;
}

export interface SessionEndEvent extends BaseEvent<'session'> {
  subtype: 'end';
  status: 'completed' | 'aborted' | 'error';
  durationMs: number;
  eventCount: number;
  gitRef: string;
  errorMessage?: string;
}

export type SessionEvent = SessionStartEvent | SessionEndEvent;

// ---- PromptEvent ----

export interface PromptEvent extends BaseEvent<'prompt'> {
  content: string;
  agentType: AgentType;
  model?: string;
  tokenCount?: number;
  role: 'user' | 'assistant';
  attachments?: Array<{
    type: 'file' | 'image' | 'url';
    path?: string;
    url?: string;
    description?: string;
  }>;
}

// ---- CommandEvent ----

export interface CommandEvent extends BaseEvent<'command'> {
  command: string;
  cwd: string;
  exitCode?: number;
  durationMs?: number;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  stdout?: string;
  stderr?: string;
}

// ---- DiffEvent ----

export interface DiffFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  previousPath?: string;
}

export interface DiffEvent extends BaseEvent<'diff'> {
  files: DiffFileChange[];
  patch?: string;
  totalAdditions: number;
  totalDeletions: number;
  isBaseline: boolean;
  snapshotLabel?: string;
}

// ---- ToolEvent ----

export interface ToolEvent extends BaseEvent<'tool'> {
  name: string;
  agentType: AgentType;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  durationMs?: number;
  status: 'success' | 'error' | 'interrupted';
  errorMessage?: string;
}

// ---- TestEvent ----

export interface TestEvent extends BaseEvent<'test'> {
  framework?: string;
  command: string;
  outcome: TestOutcome;
  totalTests?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  durationMs?: number;
  failures?: Array<{
    testName: string;
    filePath?: string;
    message: string;
    stackTrace?: string;
  }>;
  stdout?: string;
  stderr?: string;
}

// ---- TerminalOutputEvent ----

export interface TerminalOutputEvent extends BaseEvent<'terminal_output'> {
  stream: 'stdout' | 'stderr';
  content: string;
  isChunk: boolean;
  sequenceNumber: number;
}

// ---- RetryEvent ----

export interface RetryEvent extends BaseEvent<'retry'> {
  attemptNumber: number;
  maxAttempts?: number;
  reason: string;
  originalEventId?: string;
  retryTarget?: string;
}

// ---- Union Type ----

export type AIFREvent =
  | SessionEvent
  | PromptEvent
  | CommandEvent
  | DiffEvent
  | ToolEvent
  | TestEvent
  | TerminalOutputEvent
  | RetryEvent;
