# AIFR Session Format

## Overview

AIFR records AI-assisted development sessions as structured event streams.
Each session is a directory containing an append-only JSONL file, metadata,
and supporting artifacts.

## Session Directory Structure

```
.aifr/sessions/{timestamp}_{sessionId}/
├── events.jsonl          # Canonical event stream (append-only JSONL)
├── metadata.json         # Session metadata
├── terminal.log          # Raw terminal output (Phase 2+)
├── git/
│   ├── before.patch      # Git diff at session start
│   └── after.patch       # Git diff at session end
└── replay/               # Replay artifacts
```

## Event Stream Format (events.jsonl)

- One JSON object per line
- UTF-8 encoding, LF (`\n`) line endings
- Lines starting with `#` are comments (ignored during parsing)
- Empty lines are skipped
- Events are append-only; never modify existing lines

## Event Schema

All events share a common base structure:

```json
{
  "id": "string",
  "sessionId": "string",
  "type": "session | prompt | command | diff | tool | test | terminal_output | retry",
  "timestamp": 1716710400000,
  "schemaVersion": "0.1.0"
}
```

## Event Types

### Session Events

Two subtypes: `start` and `end`.

**Session Start** (`type: "session", subtype: "start"`):

```json
{
  "id": "evt_001",
  "sessionId": "20260526120011_abc123",
  "type": "session",
  "subtype": "start",
  "timestamp": 1716710400000,
  "schemaVersion": "0.1.0",
  "projectPath": "/path/to/project",
  "agentType": "claude",
  "gitRef": "abc1234",
  "gitBranch": "main",
  "osPlatform": "win32",
  "osRelease": "10.0.26200",
  "shell": "powershell",
  "aifrVersion": "0.1.0"
}
```

**Session End** (`type: "session", subtype: "end"`):

```json
{
  "id": "evt_999",
  "sessionId": "20260526120011_abc123",
  "type": "session",
  "subtype": "end",
  "timestamp": 1716714000000,
  "schemaVersion": "0.1.0",
  "status": "completed",
  "durationMs": 3600000,
  "eventCount": 42,
  "gitRef": "def5678"
}
```

### Prompt Events

Records a prompt sent to or received from an AI agent.

```json
{
  "id": "evt_010",
  "sessionId": "20260526120011_abc123",
  "type": "prompt",
  "timestamp": 1716710460000,
  "schemaVersion": "0.1.0",
  "content": "Refactor the scheduler module",
  "agentType": "claude",
  "role": "user"
}
```

### Command Events

Records a terminal command execution.

```json
{
  "id": "evt_020",
  "sessionId": "20260526120011_abc123",
  "type": "command",
  "timestamp": 1716710520000,
  "schemaVersion": "0.1.0",
  "command": "npm test",
  "cwd": "/path/to/project",
  "exitCode": 1,
  "status": "failed",
  "durationMs": 5200
}
```

### Diff Events

Records code changes. `isBaseline: true` means the diff was captured at session start, not triggered by an agent action.

```json
{
  "id": "evt_030",
  "sessionId": "20260526120011_abc123",
  "type": "diff",
  "timestamp": 1716710580000,
  "schemaVersion": "0.1.0",
  "files": [
    {
      "path": "src/scheduler.ts",
      "status": "modified",
      "additions": 12,
      "deletions": 3
    }
  ],
  "totalAdditions": 12,
  "totalDeletions": 3,
  "isBaseline": false
}
```

### Tool Events

Records a tool call by an AI agent (Read, Bash, Edit, etc.).

```json
{
  "id": "evt_040",
  "sessionId": "20260526120011_abc123",
  "type": "tool",
  "timestamp": 1716710640000,
  "schemaVersion": "0.1.0",
  "name": "Edit",
  "agentType": "claude",
  "input": { "file_path": "src/scheduler.ts" },
  "status": "success",
  "durationMs": 150
}
```

### Test Events

Records test execution results.

```json
{
  "id": "evt_050",
  "sessionId": "20260526120011_abc123",
  "type": "test",
  "timestamp": 1716710700000,
  "schemaVersion": "0.1.0",
  "framework": "vitest",
  "command": "npm test",
  "outcome": "fail",
  "totalTests": 24,
  "passed": 22,
  "failed": 2,
  "durationMs": 3100
}
```

### Terminal Output Events

Records streaming terminal output. `isChunk: true` indicates partial output.

```json
{
  "id": "evt_060",
  "sessionId": "20260526120011_abc123",
  "type": "terminal_output",
  "timestamp": 1716710760000,
  "schemaVersion": "0.1.0",
  "stream": "stdout",
  "content": "PASS src/utils.test.ts\n",
  "isChunk": false,
  "sequenceNumber": 1
}
```

### Retry Events

Records a retry attempt. `originalEventId` links back to the event that failed.

```json
{
  "id": "evt_070",
  "sessionId": "20260526120011_abc123",
  "type": "retry",
  "timestamp": 1716710820000,
  "schemaVersion": "0.1.0",
  "attemptNumber": 2,
  "reason": "Test failures detected",
  "originalEventId": "evt_050",
  "retryTarget": "npm test"
}
```

## Metadata Format (metadata.json)

```json
{
  "sessionId": "20260526120011_abc123",
  "projectPath": "/path/to/project",
  "agentType": "claude",
  "startTime": 1716710400000,
  "endTime": 1716714000000,
  "durationMs": 3600000,
  "gitRef": "def5678",
  "status": "completed",
  "eventCount": 42
}
```

## Schema Versioning

Current schema version: `0.1.0`

All events include a `schemaVersion` field. Future versions will maintain
backward compatibility. Events with unrecognized fields should be preserved
and logged, not discarded.

## Design Principles

1. **Append-only**: Events are never modified after writing
2. **Self-describing**: Each event carries its type and schema version
3. **Fault-tolerant**: A partially-written file is still valid up to the last complete line
4. **Human-readable**: JSONL can be inspected with any text editor
5. **Local-first**: All data stays on disk, no cloud sync
