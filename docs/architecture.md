# AIFR Architecture

## Core Abstractions

### Event Stream

The fundamental data unit is an **event stream** — an append-only JSONL file where each line is a self-describing, schema-versioned event. Events are never modified after writing.

### Session

A **session** is a directory containing:

- `events.jsonl` — Canonical event stream
- `metadata.json` — Session metadata (ID, project, agent, timestamps, git refs)
- `terminal.log` — Raw terminal output (from PTY recording)
- `git/before.patch` — Git diff at session start
- `git/after.patch` — Git diff at session end

Sessions are stored in `.aifr/sessions/{timestamp}_{sessionId}/`.

### Execution Graph

The product's core visual model is an **execution graph**: Prompt → Command → Diff → Retry → Test → Final Patch. This is what differentiates AIFR from chat export tools.

## Package Responsibilities

### `@aifr/event-schema`

Defines 8 event types with TypeScript interfaces and Zod v4 runtime validation schemas. All other packages depend on this for type safety.

- Uses discriminated unions (`type` field) for event type narrowing
- `SessionEvent` has an inner discriminator (`subtype: 'start' | 'end'`)
- `DiffEvent` carries `isBaseline` to distinguish session-start snapshots from agent-driven changes

### `@aifr/core`

Session lifecycle management and I/O:

- **Session** — Orchestrates start/end, creates directory structure, captures git baseline
- **EventWriter** — JSONL append pipeline using `fs.createWriteStream`
- **Git operations** — Baseline capture, diff-to-file, repo detection via `simple-git`
- **TerminalRecorder** — PTY wrapper via `node-pty`, buffers output into `TerminalOutputEvent`s

### `@aifr/parser-claude`

Parses Claude Code's local session JSONL (`~/.claude/projects/{project}/{session}.jsonl`):

- Discovers sessions across all projects
- Converts `user` entries → `PromptEvent`
- Converts `assistant` entries with `tool_use` blocks → `CommandEvent` (for Bash) or `ToolEvent` (for Edit/Write/Read)
- Generates synthetic `SessionStartEvent`/`SessionEndEvent` wrappers

### `@aifr/parser-codex`

Parses Codex CLI's session JSONL (`~/.codex/sessions/{year}/{month}/{day}/rollout-*.jsonl`):

- Walks nested date-based directory structure
- Converts `event_msg/user_message` → `PromptEvent`
- Converts `event_msg/exec_command_end` → `CommandEvent`
- Converts `response_item/function_call` with `shell_command` → `CommandEvent`
- Converts `event_msg/patch_apply_end` → `ToolEvent`

### `@aifr/cli`

Commander.js CLI with commands: `init`, `start`, `status`, `import`.

### `@aifr/web`

Next.js 14 App Router web application with server-side rendering:

- **Project discovery** — Scans common dev directories for `.aifr/` folders
- **Timeline** — Chronological event list with type icons
- **Diff** — diff2html side-by-side rendering with file tabs
- **Replay** — xterm.js terminal playback with progress bar and event markers
- **Prompt-to-Diff** — Maps prompts to subsequent diffs with confidence indicators
- **Events** — Searchable raw event browser with JSON detail drawer

## Data Flow

```
Claude Code / Codex CLI
    │
    ├── aifr start (PTY recording) ──→ events.jsonl + terminal.log
    │
    └── aifr import <agent> ──→ parser-* ──→ AIFR events ──→ .aifr/sessions/

Web UI ──→ discovers .aifr/ ──→ reads events.jsonl ──→ renders views
```

## Design Principles

1. **JSONL is canonical** — SQLite can be an index layer, but JSONL is the source of truth
2. **Append-only** — Events are never modified; partial writes are recoverable
3. **Local-first** — All data stays on disk; no cloud sync in v0.1
4. **Parser fault tolerance** — Parsers produce diagnostic errors, not silent failures
5. **Event stream > Chat transcript** — The core abstraction is an execution graph
