# Known Limitations (v0.1)

## General

- **Local only** — All data stays on disk. No cloud sync, sharing, or collaboration features.
- **No search** — No full-text search across sessions (planned for v0.2 with SQLite FTS).
- **No secret redaction** — Terminal output (`terminal.log`), prompts, command arguments, and diffs may contain API keys, tokens, passwords, or other sensitive data. The Web UI renders these as-is. Review session contents before sharing or exporting `.aifr/` directories.

## CLI

- **`aifr start` requires a PTY** — The `start` command spawns an interactive terminal via `node-pty`. It does not work in non-interactive environments (CI, pipes).
- **Windows-only PTY tested** — Terminal recording has been tested on Windows. macOS and Linux PTY behavior may differ.
- **No background recording** — The recording process must remain in the foreground. Closing the terminal ends the session.
- **No `aifr replay` CLI command** — Replay is only available in the Web UI.

## Import

- **Imported diff is point-in-time** — The git diff captured during import reflects the project state at import time, not the session's original state. Marked with "Captured at import time" label.
- **Codex sessions have no cwd** — Codex session files don't record the working directory, so git diff capture is not possible for Codex imports.
- **Claude cwd from attachment entries** — The importer extracts the project path from attachment entries in the session JSONL. If the session has no attachments, cwd detection fails.

## Parsers

- **Claude Code format may change** — The parser reads `~/.claude/projects/` JSONL files. If Anthropic changes the format in a future Claude Code update, the parser may break.
- **Codex CLI format may change** — Same risk for `~/.codex/sessions/` JSONL files.
- **No Cursor support** — `packages/parser-cursor` is scaffolded but not implemented.
- **No timestamp for all events** — Some imported events may have approximate timestamps if the source format lacks precise timing.
- **Prompt-to-Diff mapping is heuristic** — The mapping between prompts and diffs is based on temporal proximity, not provenance tracking. Results should be treated as suggestions, not facts.

## Web UI

- **No dark/light mode toggle** — Only dark mode is implemented.
- **Terminal replay is basic** — The replay view renders raw terminal output but does not support speed control or seeking beyond what's shown.
- **No keyboard shortcuts** — Navigation is mouse-only in v0.1.
- **Syntax highlighting is optional** — Enabled via checkbox to avoid performance issues with large diffs. Supported for TS/JS, CSS, JSON, YAML.

## Platform

- **Windows primary** — Developed and tested on Windows 11. macOS and Linux should work but are not tested.
- **Node.js v20+ required** — Earlier versions are not supported.
- **pnpm required** — npm and yarn are not supported for monorepo workspace management.
