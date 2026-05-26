# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AIFR (AI Flight Recorder)** — "OpenTelemetry for AI Software Development"

An observability platform for AI-assisted software development workflows. It records AI coding sessions (Prompts, commands, code diffs, tests, retries, terminal output) as a replayable, auditable event stream — not as chat transcripts, but as structured execution graphs.

Positioning: Serves developers using Claude Code, Codex CLI, Cursor, and other terminal-based coding agents.

## Architecture

### Target Monorepo Structure

```
aifr/
├── apps/
│   ├── cli/              # CLI app (Node.js + TypeScript)
│   │   └── src/
│   │       ├── index.ts       # Entry point
│   │       ├── commands/      # CLI commands: init, start, replay, diff, status
│   │       ├── recorder/      # Terminal recording (node-pty)
│   │       ├── parsers/       # Agent session parsers
│   │       └── git/           # Git operations (simple-git)
│   └── web/              # Web UI (Next.js)
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── public/
├── packages/
│   ├── core/             # Core: Session → Event Stream conversion
│   ├── parser-claude/    # Parse Claude Code sessions (~/.claude/projects/)
│   ├── parser-codex/     # Parse Codex CLI sessions (~/.codex/sessions/)
│   ├── parser-cursor/    # Parse Cursor sessions (scaffold first)
│   ├── event-schema/     # Unified event type definitions
│   └── replay-engine/    # Terminal replay engine
├── examples/             # Desensitized example sessions
│   ├── claude-session/
│   ├── codex-session/
│   └── cursor-session/
├── docs/
│   ├── architecture.md
│   ├── roadmap.md
│   └── session-format.md
└── scripts/
    ├── install.ps1       # Windows installer
    └── install.sh        # Unix installer
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| CLI | Node.js + TypeScript |
| Web | Next.js |
| UI | Tailwind + shadcn |
| Replay | xterm.js |
| DB | SQLite |
| Events | JSONL (append-friendly, human-readable) |
| Git | simple-git |
| Terminal | node-pty |
| Diff | diff2html |
| Search | SQLite FTS |

### Event Schema

All events are normalized into a unified JSONL event stream. Core event types:

- `PromptEvent` — AI request content
- `CommandEvent` — terminal command execution
- `DiffEvent` — code changes (file list + patch)
- `ToolEvent` — tool/API calls
- `TestEvent` — test results
- `SessionEvent` — session lifecycle (start/end)
- `TerminalOutputEvent` — terminal stdout/stderr
- `RetryEvent` — retry attempts

### Session Storage

Local-first. Sessions stored in `.aifr/sessions/{timestamp}/`:

```
.aifr/sessions/20260526_120011/
├── events.jsonl          # Canonical event stream
├── terminal.log          # Raw terminal output
├── metadata.json         # Session metadata (ID, project, agent, timestamps, git ref)
├── git/
│   ├── before.patch      # Git diff at session start
│   └── after.patch       # Git diff at session end
└── replay/               # Replay data
```

## CLI Commands

Planned CLI interface (not yet implemented):

- `aifr init` — Initialize `.aifr/` directory in current git repo
- `aifr start` — Start recording a new session
- `aifr replay` — Replay a session's event stream and terminal output
- `aifr diff` — View code changes captured in a session
- `aifr status` — Check current recording status

## Integration Points

- **Claude Code**: reads `~/.claude/projects/`
- **Codex CLI**: reads `~/.codex/sessions/`
- **Cursor**: scaffold ready, implementation pending
- **Git**: via `simple-git`
- **Terminal recording**: via `node-pty`
- **Web replay**: via `xterm.js`
- **Diff visualization**: via `diff2html`

## Key Design Principles

1. **Event stream > Chat transcript** — The core abstraction is an execution graph, not a conversation log
2. **Local-first** — All data stays on disk; no cloud sync in v0.1
3. **JSONL as canonical artifact** — SQLite is an index layer, not the source of truth
4. **Prompt-to-Diff mapping** — Most important product interaction, but must be marked as inferred/probabilistic
5. **Parser fault tolerance** — Parsers should produce diagnostic errors on malformed input, not silently fail
6. **Developer tool UI** — High information density, keyboard-friendly, code-review oriented

## Non-Goals for v0.1

- No RAG, Embeddings, AI Summary, or Agent orchestration
- No enterprise collaboration, cloud sync, or complex permissions
- Not a chat recorder or chat export viewer

## Platform

- Primary development platform: Windows (PowerShell)
- Must support macOS and Linux
- Windows support requires special attention: PowerShell syntax, path formats, PTY behavior

## Development Workflow

The project has not yet been scaffolded. Once the monorepo is created:
1. Run `npm install` or equivalent at the monorepo root
2. Use workspace commands to build/test individual packages
3. Run the CLI via `npx` or `npm run` from `apps/cli/`
4. Start the web UI from `apps/web/`

## Current Status

**Pre-implementation phase.** Only the PRD exists at `prd/AIFR_AI Flight Recorder_PRD ___.md`. The next step is Phase 1: Core Event Model and CLI Skeleton — defining the event schema, scaffolding the monorepo, and implementing `aifr init`.
