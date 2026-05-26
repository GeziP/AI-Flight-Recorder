import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  generateEventId,
  generateSessionId,
  AIFR_EVENT_SCHEMA_VERSION,
  type AIFREvent,
  type SessionStartEvent,
  type SessionEndEvent,
  type PromptEvent,
  type CommandEvent,
  type ToolEvent,
} from '@aifr/event-schema';
import type {
  CodexEntry,
  CodexSessionMeta,
  CodexEventMsg,
  CodexResponseItem,
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

/**
 * Parse a single Codex CLI JSONL session file into AIFR events.
 */
export async function parseCodexSession(
  filePath: string,
  sessionId?: string
): Promise<ParseResult> {
  const content = await readFile(filePath, 'utf8');
  return parseCodexSessionFromString(content, filePath, sessionId);
}

/**
 * Parse Codex CLI JSONL content from a string.
 */
export function parseCodexSessionFromString(
  content: string,
  sourceFile: string,
  sessionId?: string
): ParseResult {
  const sid = sessionId ?? generateSessionId();
  const events: AIFREvent[] = [];
  const errors: ParseError[] = [];
  const lines = content.split('\n');

  let sourceSessionId = '';
  let cwd = '';
  let cliVersion = '';
  let gitBranch = '';
  let model = '';
  let firstTs: number | null = null;
  let lastTs: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    let entry: CodexEntry;
    try {
      entry = JSON.parse(line) as CodexEntry;
    } catch {
      errors.push({ line: i + 1, message: 'Invalid JSON', raw: line.substring(0, 100) });
      continue;
    }

    const ts = parseTimestamp(entry.timestamp);

    // Extract metadata from session_meta
    if (entry.type === 'session_meta') {
      const meta = entry as CodexSessionMeta;
      sourceSessionId = meta.payload.id;
      cwd = meta.payload.cwd;
      cliVersion = meta.payload.cli_version;
      if (meta.payload.git?.branch) gitBranch = meta.payload.git.branch;
    }

    try {
      const parsed = convertEntry(entry, sid, ts);
      if (parsed) {
        for (const event of parsed) {
          if (!firstTs || event.timestamp < firstTs) firstTs = event.timestamp;
          lastTs = event.timestamp;
          events.push(event);
        }
      }
    } catch (err) {
      errors.push({
        line: i + 1,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Wrap with session start/end events
  if (events.length > 0 && firstTs) {
    const startEvent: SessionStartEvent = {
      id: generateEventId(),
      sessionId: sid,
      type: 'session',
      subtype: 'start',
      timestamp: firstTs,
      schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
      projectPath: cwd,
      agentType: 'codex',
      gitRef: 'imported',
      gitBranch,
      osPlatform: 'unknown',
      osRelease: 'unknown',
      shell: 'unknown',
      aifrVersion: cliVersion || 'unknown',
      metadata: { sourceSessionId, sourceFile: basename(sourceFile), model },
    };
    events.unshift(startEvent);

    const endEvent: SessionEndEvent = {
      id: generateEventId(),
      sessionId: sid,
      type: 'session',
      subtype: 'end',
      timestamp: lastTs!,
      schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
      status: 'completed',
      durationMs: lastTs! - firstTs,
      eventCount: events.length,
      gitRef: 'imported',
    };
    events.push(endEvent);
  }

  return {
    sessionId: sid,
    sourceSessionId,
    sourceFile,
    events,
    errors,
  };
}

function convertEntry(
  entry: CodexEntry,
  sessionId: string,
  timestamp: number
): AIFREvent[] | null {
  switch (entry.type) {
    case 'event_msg':
      return convertEventMsg(entry as CodexEventMsg, sessionId, timestamp);
    case 'response_item':
      return convertResponseItem(entry as CodexResponseItem, sessionId, timestamp);
    default:
      return null;
  }
}

function convertEventMsg(
  entry: CodexEventMsg,
  sessionId: string,
  timestamp: number
): AIFREvent[] | null {
  const payloadType = entry.payload?.type;

  switch (payloadType) {
    case 'user_message': {
      const text = entry.payload.content || entry.payload.text || '';
      if (!text) return null;
      return [{
        id: generateEventId(),
        sessionId,
        type: 'prompt',
        timestamp,
        schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
        content: text,
        agentType: 'codex',
        role: 'user',
      }];
    }

    case 'agent_message': {
      const text = entry.payload.content || entry.payload.text || '';
      if (!text) return null;
      return [{
        id: generateEventId(),
        sessionId,
        type: 'prompt',
        timestamp,
        schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
        content: text,
        agentType: 'codex',
        role: 'assistant',
      }];
    }

    case 'exec_command_end': {
      const cmd = entry.payload.command || '';
      if (!cmd) return null;
      return [{
        id: generateEventId(),
        sessionId,
        type: 'command',
        timestamp,
        schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
        command: cmd,
        cwd: '',
        exitCode: entry.payload.exit_code,
        status: entry.payload.exit_code === 0 ? 'completed' : 'failed',
        durationMs: entry.payload.duration_ms,
        stdout: entry.payload.output,
      }];
    }

    case 'patch_apply_end': {
      return [{
        id: generateEventId(),
        sessionId,
        type: 'tool',
        timestamp,
        schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
        name: 'apply_patch',
        agentType: 'codex',
        input: { path: entry.payload.path },
        status: entry.payload.exit_code === 0 ? 'success' : 'error',
      }];
    }

    default:
      return null;
  }
}

function convertResponseItem(
  entry: CodexResponseItem,
  sessionId: string,
  timestamp: number
): AIFREvent[] | null {
  const payload = entry.payload;
  if (!payload) return null;

  switch (payload.type) {
    case 'function_call': {
      if (payload.name === 'shell_command') {
        // Parse shell command from arguments
        let command = '';
        try {
          const args = typeof payload.arguments === 'string'
            ? JSON.parse(payload.arguments)
            : payload.arguments;
          command = args?.command || args?.cmd || '';
        } catch {
          command = payload.arguments || '';
        }

        if (command) {
          return [{
            id: generateEventId(),
            sessionId,
            type: 'command',
            timestamp,
            schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
            command,
            cwd: '',
            status: 'running',
          }];
        }
      }

      return [{
        id: generateEventId(),
        sessionId,
        type: 'tool',
        timestamp,
        schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
        name: payload.name || 'unknown',
        agentType: 'codex',
        input: { arguments: payload.arguments },
        status: 'success',
      }];
    }

    case 'custom_tool_call': {
      return [{
        id: generateEventId(),
        sessionId,
        type: 'tool',
        timestamp,
        schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
        name: payload.name || 'unknown',
        agentType: 'codex',
        input: { arguments: payload.arguments },
        status: 'success',
      }];
    }

    default:
      return null;
  }
}

function parseTimestamp(ts: string | undefined): number {
  if (!ts) return Date.now();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
}
