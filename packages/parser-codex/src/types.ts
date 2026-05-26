/**
 * Raw types from Codex CLI's ~/.codex/sessions/{year}/{month}/{day}/rollout-*.jsonl
 * Each line has: { timestamp, type, payload }
 */

export interface CodexBaseEntry {
  timestamp: string;
  type: string;
  payload: unknown;
}

export interface CodexSessionMeta extends CodexBaseEntry {
  type: 'session_meta';
  payload: {
    id: string;
    timestamp: string;
    cwd: string;
    originator: string;
    cli_version: string;
    source: string;
    model_provider: string;
    git?: { branch?: string; commit?: string };
  };
}

export interface CodexTurnContext extends CodexBaseEntry {
  type: 'turn_context';
  payload: {
    turn_id: string;
    cwd: string;
    current_date: string;
    timezone: string;
    model: string;
    approval_policy: string;
  };
}

export interface CodexEventMsg extends CodexBaseEntry {
  type: 'event_msg';
  payload: {
    type: string;
    turn_id?: string;
    model_context_window?: number;
    content?: string;
    text?: string;
    exit_code?: number;
    duration_ms?: number;
    command?: string;
    output?: string;
    path?: string;
  };
}

export interface CodexResponseItem extends CodexBaseEntry {
  type: 'response_item';
  payload: {
    type: 'message' | 'reasoning' | 'function_call' | 'function_call_output' | 'custom_tool_call' | 'custom_tool_call_output';
    role?: string;
    content?: Array<{ type: string; text?: string }>;
    name?: string;
    arguments?: string;
    call_id?: string;
    output?: string;
  };
}

export interface CodexCompacted extends CodexBaseEntry {
  type: 'compacted';
  payload: unknown;
}

export type CodexEntry = CodexSessionMeta | CodexTurnContext | CodexEventMsg | CodexResponseItem | CodexCompacted;
