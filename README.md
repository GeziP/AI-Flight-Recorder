# AIFR — AI Flight Recorder

> OpenTelemetry for AI Software Development

Record, replay, and analyze AI-assisted software development workflows.

AIFR captures AI coding sessions as structured event streams — not chat transcripts, but execution graphs. Every prompt, command, file change, test result, and retry is recorded as a replayable, auditable timeline.

## What AIFR Does

When you use an AI coding agent (Claude Code, Codex CLI), a lot happens between your prompt and the final code change. AIFR captures the full picture:

- **Prompt** → the instruction you gave the AI
- **Command** → terminal commands the AI executed
- **Diff** → files changed and how
- **Test** → test results (pass/fail)
- **Retry** → when the AI tried again after a failure
- **Terminal Output** → raw stdout/stderr from the session

You can browse this timeline, replay the terminal session, and see which prompt produced which code change.

## Screenshots

### Homepage

<img src="docs/screenshots/homepage.png" width="600" alt="AIFR Homepage" />

### Timeline

Chronological event stream with colored markers for prompts, commands, tools, diffs, tests, and retries.

<img src="docs/screenshots/timeline.png" width="700" alt="Timeline view" />

### Events

Search, filter by type, and inspect raw JSON for any event.

<img src="docs/screenshots/events-detail.png" width="700" alt="Events view with JSON detail panel" />

### Replay

Terminal playback with play/pause, speed control (1x/2x/4x), and event markers on the progress bar.

<img src="docs/screenshots/replay.png" width="700" alt="Replay view with terminal playback" />

### Prompt-to-Diff

Select a prompt and see its execution path — which tools were called and what files changed.

<img src="docs/screenshots/prompt-to-diff.png" width="700" alt="Prompt-to-Diff mapping view" />

### Codex CLI Support

Imported Codex CLI sessions display correctly with agent identification and command events.

<img src="docs/screenshots/codex-timeline.png" width="700" alt="Codex CLI session timeline" />

## Quick Start

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Initialize in a project
pnpm aifr init

# Start recording
pnpm aifr start

# Import existing sessions
pnpm aifr import claude --limit 10
pnpm aifr import codex --limit 10
```

### Step 1: Initialize

```bash
pnpm aifr init
```

Creates a `.aifr/` directory in your project. This is where all session data is stored locally.

### Step 2: Record a Session

```bash
pnpm aifr start
```

Opens a terminal recorder. Use your AI coding agent as usual (Claude Code, Codex CLI, etc.). When you exit the terminal, the session is saved automatically.

### Step 3: Import Existing Sessions

If you've already used Claude Code or Codex CLI, AIFR can import past sessions:

```bash
pnpm aifr import claude          # Import last 10 Claude Code sessions
pnpm aifr import codex --limit 5 # Import last 5 Codex CLI sessions
```

Sessions are imported from:
- Claude Code: `~/.claude/projects/`
- Codex CLI: `~/.codex/sessions/`

### Step 4: Browse in Web UI

```bash
pnpm run dev:web
# Open http://localhost:3000
```

The Web UI shows all discovered projects and sessions. Click into a session to explore:

| View | What it shows |
|------|--------------|
| **Timeline** | All events in chronological order — prompts, commands, diffs, tests, retries |
| **Prompt-to-Diff** | Maps each AI prompt to the code changes it produced |
| **Diff** | Side-by-side diff visualization for file changes |
| **Replay** | Terminal playback with xterm.js — play, pause, change speed |
| **Events** | Raw event browser with search, filter by type, and JSON detail drawer |

## CLI Commands

| Command | Description |
|---------|-------------|
| `aifr init` | Initialize `.aifr/` in the current project |
| `aifr start` | Start recording a new session (opens a terminal) |
| `aifr status` | List recorded sessions |
| `aifr import claude` | Import Claude Code sessions |
| `aifr import codex` | Import Codex CLI sessions |

## Supported AI Agents

| Agent | Import | Live Recording |
|-------|--------|----------------|
| Claude Code | Yes | Yes |
| Codex CLI | Yes | Yes |
| Cursor | Planned | Planned |

## Data Storage

All data stays on your machine. Sessions are stored in `.aifr/sessions/`:

```
.aifr/sessions/
  20260526_120011/
    events.jsonl          # Structured event stream
    terminal.log          # Raw terminal output
    metadata.json         # Session info (timestamps, agent, git ref)
    git/
      before.patch        # Git diff at session start
      after.patch         # Git diff at session end
```

No data is uploaded anywhere. No cloud sync. No telemetry.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Type-check
pnpm typecheck

# Run CLI
pnpm aifr <command>

# Start web UI
pnpm run dev:web
```

## Known Limitations

- Imported sessions have no structured diff events or git patches
- Codex sessions contain commands but no user prompts in the event stream
- Replay playback is based on terminal log output, not structured timing data
- Prompt-to-Diff mapping is inferred, not guaranteed to be exact

See [docs/known-limitations.md](docs/known-limitations.md) for details.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for planned features including Cursor support, SQLite search, and more.

## License

MIT
