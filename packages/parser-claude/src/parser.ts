import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import {
  generateEventId,
  generateSessionId,
  AIFR_EVENT_SCHEMA_VERSION,
  type AIFREvent,
  type SessionStartEvent,
  type SessionEndEvent,
  type PromptEvent,
  type CommandEvent,
  type DiffEvent,
  type ToolEvent,
} from '@aifr/event-schema';
import type {
  ClaudeEntry,
  ClaudeUser,
  ClaudeAssistant,
  ClaudeSystem,
  ClaudeAttachment,
  ContentBlock,
} from './types.js';

export interface ParseResult {
  sessionId: string;
  sourceSessionId: string;
  sourceFile: string;
  events: AIFREvent[];
  errors: ParseError[];
}

export interface ParseError {
  line: number;
  message: string;
  raw?: string;
}

export interface ParseOptions {
  sessionId?: string;
  /**
   * Map of tool_call_id -> file path for associating tool results.
   * Not used in v0.1 but reserved for future enhancement.
   */
}

/**
 * Parse a single Claude Code JSONL session file into AIFR events.
 */
export async function parseClaudeSession(
  filePath: string,
  options?: ParseOptions
): Promise<ParseResult> {
  const content = await readFile(filePath, 'utf8');
  return parseClaudeSessionFromString(content, filePath, options);
}

/**
 * Parse Claude Code JSONL content from a string.
 */
export function parseClaudeSessionFromString(
  content: string,
  sourceFile: string,
  options?: ParseOptions
): ParseResult {
  const sessionId = options?.sessionId ?? generateSessionId();
  const events: AIFREvent[] = [];
  const errors: ParseError[] = [];
  const lines = content.split('\n');

  let sessionStartTs: number | null = null;
  let sessionEndTs: number | null = null;
  let cwd = '';
  let gitBranch = '';
  let claudeVersion = '';
  let sourceSessionId = '';
  let eventCount = 0;

  // First pass: collect metadata
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    try {
      const entry = JSON.parse(line) as ClaudeEntry;
      if ('sessionId' in entry && entry.sessionId && !sourceSessionId) {
        sourceSessionId = entry.sessionId as string;
      }
      if ('cwd' in entry && entry.cwd && !cwd) {
        cwd = entry.cwd as string;
      }
      if ('gitBranch' in entry && entry.gitBranch && !gitBranch) {
        gitBranch = entry.gitBranch as string;
      }
      if ('version' in entry && entry.version && !claudeVersion) {
        claudeVersion = entry.version as string;
      }
    } catch {
      // Ignore metadata parse errors
    }
  }

  // Second pass: convert entries to AIFR events
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    let entry: ClaudeEntry;
    try {
      entry = JSON.parse(line) as ClaudeEntry;
    } catch {
      errors.push({ line: i + 1, message: 'Invalid JSON', raw: line.substring(0, 100) });
      continue;
    }

    try {
      const parsed = convertEntry(entry, sessionId, claudeVersion);
      if (parsed) {
        for (const event of parsed) {
          if (!sessionStartTs || event.timestamp < sessionStartTs) {
            sessionStartTs = event.timestamp;
          }
          sessionEndTs = event.timestamp;
          events.push(event);
          eventCount++;
        }
      }
    } catch (err) {
      errors.push({
        line: i + 1,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Add synthetic session start/end events if not present
  if (sessionStartTs && events.length > 0) {
    const startEvent: SessionStartEvent = {
      id: generateEventId(),
      sessionId,
      type: 'session',
      subtype: 'start',
      timestamp: sessionStartTs,
      schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
      projectPath: cwd,
      agentType: 'claude',
      gitRef: 'imported',
      gitBranch,
      osPlatform: 'unknown',
      osRelease: 'unknown',
      shell: 'unknown',
      aifrVersion: claudeVersion || 'unknown',
      metadata: { sourceSessionId, sourceFile: basename(sourceFile) },
    };
    events.unshift(startEvent);

    const endEvent: SessionEndEvent = {
      id: generateEventId(),
      sessionId,
      type: 'session',
      subtype: 'end',
      timestamp: sessionEndTs!,
      schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
      status: 'completed',
      durationMs: sessionEndTs! - sessionStartTs,
      eventCount,
      gitRef: 'imported',
    };
    events.push(endEvent);
  }

  return {
    sessionId,
    sourceSessionId,
    sourceFile,
    events,
    errors,
  };
}

/**
 * Convert a single Claude entry to one or more AIFR events.
 */
function convertEntry(
  entry: ClaudeEntry,
  sessionId: string,
  version: string
): AIFREvent[] | null {
  switch (entry.type) {
    case 'user':
      return convertUserEntry(entry as ClaudeUser, sessionId);
    case 'assistant':
      return convertAssistantEntry(entry as ClaudeAssistant, sessionId);
    case 'system':
      return convertSystemEntry(entry as ClaudeSystem, sessionId);
    case 'attachment':
      return null; // Metadata only
    default:
      return null; // Skip metadata types
  }
}

function parseTimestamp(ts: string | undefined): number {
  if (!ts) return Date.now();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
}

function convertUserEntry(
  entry: ClaudeUser,
  sessionId: string
): AIFREvent[] {
  const timestamp = parseTimestamp(entry.timestamp);
  const content = typeof entry.message?.content === 'string'
    ? entry.message.content
    : '';

  const event: PromptEvent = {
    id: generateEventId(),
    sessionId,
    type: 'prompt',
    timestamp,
    schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
    content,
    agentType: 'claude',
    role: 'user',
  };

  return [event];
}

function convertAssistantEntry(
  entry: ClaudeAssistant,
  sessionId: string
): AIFREvent[] {
  const events: AIFREvent[] = [];
  const timestamp = parseTimestamp(entry.timestamp);
  const content = entry.message?.content;

  if (!Array.isArray(content)) return events;

  let textParts: string[] = [];

  for (const block of content) {
    if (block.type === 'text' && block.text) {
      textParts.push(block.text);
    } else if (block.type === 'tool_use') {
      // Flush accumulated text as a prompt event
      if (textParts.length > 0) {
        events.push({
          id: generateEventId(),
          sessionId,
          type: 'prompt',
          timestamp,
          schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
          content: textParts.join('\n'),
          agentType: 'claude',
          role: 'assistant',
          model: entry.message?.model,
        });
        textParts = [];
      }

      events.push(convertToolUse(block, sessionId, timestamp));
    }
    // Skip 'thinking' blocks - they're internal reasoning
  }

  // Flush remaining text
  if (textParts.length > 0) {
    events.push({
      id: generateEventId(),
      sessionId,
      type: 'prompt',
      timestamp,
      schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
      content: textParts.join('\n'),
      agentType: 'claude',
      role: 'assistant',
      model: entry.message?.model,
    });
  }

  return events;
}

function convertToolUse(
  block: ContentBlock,
  sessionId: string,
  timestamp: number
): ToolEvent | CommandEvent | DiffEvent {
  const toolName = block.name || 'unknown';
  const input = block.input || {};

  // Map specific Claude Code tools to more specific AIFR event types
  if (toolName === 'Bash') {
    return {
      id: generateEventId(),
      sessionId,
      type: 'command',
      timestamp,
      schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
      command: (input.command as string) || '',
      cwd: (input.cwd as string) || '',
      status: 'completed',
    };
  }

  if (toolName === 'Edit' || toolName === 'Write') {
    const filePath = (input.file_path as string) || '';
    return {
      id: generateEventId(),
      sessionId,
      type: 'tool',
      timestamp,
      schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
      name: toolName,
      agentType: 'claude',
      input: { filePath, ...(toolName === 'Edit' ? { oldString: input.old_string, newString: input.new_string } : {}) },
      status: 'success',
    };
  }

  // Generic tool event
  return {
    id: generateEventId(),
    sessionId,
    type: 'tool',
    timestamp,
    schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
    name: toolName,
    agentType: 'claude',
    input,
    status: 'success',
  };
}

function convertSystemEntry(
  entry: ClaudeSystem,
  sessionId: string
): AIFREvent[] | null {
  // System entries with durationMs are session lifecycle markers
  if (entry.durationMs !== undefined) {
    return [];
  }
  return null;
}
