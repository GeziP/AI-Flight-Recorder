/**
 * Raw types from Claude Code's ~/.claude/projects/{project}/{session}.jsonl
 * Each line is a JSON object with a `type` discriminator.
 */

export interface ClaudeAttachment {
  type: 'attachment';
  parentUuid: string;
  isSidechain: boolean;
  attachment: unknown;
  uuid: string;
  timestamp: string;
  userType: string;
  entrypoint: string;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
}

export interface ClaudeUser {
  type: 'user';
  parentUuid: string;
  isSidechain: boolean;
  promptId: string;
  message: {
    role: 'user';
    content: string;
  };
  uuid: string;
  timestamp: string;
  userType: string;
  entrypoint: string;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
}

export interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | ContentBlock[];
}

export interface ClaudeAssistant {
  type: 'assistant';
  parentUuid: string;
  isSidechain: boolean;
  message: {
    role: 'assistant';
    content: ContentBlock[];
    model?: string;
  };
  uuid: string;
  timestamp: string;
  userType: string;
  entrypoint: string;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
  attributionSkill?: string;
}

export interface ClaudeSystem {
  type: 'system';
  parentUuid: string;
  isSidechain: boolean;
  subtype?: string;
  durationMs?: number;
  messageCount?: number;
  uuid: string;
  timestamp: string;
  userType: string;
  entrypoint: string;
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch: string;
}

export interface ClaudeFileSnapshot {
  type: 'file-history-snapshot';
  messageId: string;
  snapshot: Record<string, string>;
  isSnapshotUpdate: boolean;
}

export interface ClaudeLastPrompt {
  type: 'last-prompt';
  leafUuid: string;
  sessionId: string;
}

export interface ClaudePermissionMode {
  type: 'permission-mode';
  permissionMode: string;
  sessionId: string;
}

export interface ClaudeAiTitle {
  type: 'ai-title';
  aiTitle: string;
  sessionId: string;
}

export type ClaudeEntry =
  | ClaudeAttachment
  | ClaudeUser
  | ClaudeAssistant
  | ClaudeSystem
  | ClaudeFileSnapshot
  | ClaudeLastPrompt
  | ClaudePermissionMode
  | ClaudeAiTitle
  | { type: string; [key: string]: unknown };
