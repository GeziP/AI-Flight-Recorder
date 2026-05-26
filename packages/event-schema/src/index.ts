// Types
export type {
  AIFREvent,
  BaseEvent,
  SessionEvent,
  SessionStartEvent,
  SessionEndEvent,
  PromptEvent,
  CommandEvent,
  DiffEvent,
  DiffFileChange,
  ToolEvent,
  TestEvent,
  TerminalOutputEvent,
  RetryEvent,
} from './types.js';

// Constants (includes type aliases)
export {
  AIFR_EVENT_SCHEMA_VERSION,
  EVENT_TYPES,
  AGENT_TYPES,
  TEST_OUTCOMES,
  type EventType,
  type AgentType,
  type TestOutcome,
} from './constants.js';

// Zod schemas
export {
  baseEventSchema,
  sessionEventSchema,
  sessionStartSchema,
  sessionEndSchema,
  promptEventSchema,
  commandEventSchema,
  diffEventSchema,
  diffFileChangeSchema,
  toolEventSchema,
  testEventSchema,
  terminalOutputEventSchema,
  retryEventSchema,
  eventSchema,
} from './schema.js';

// Utilities
export {
  validateEvent,
  parseJSONLLine,
  isEventType,
  generateEventId,
  generateSessionId,
} from './utils.js';
