# AIFR Roadmap

## v0.1 — MVP (Current)

- [x] Core event schema (8 event types + Zod validation)
- [x] CLI: `aifr init`, `aifr start`, `aifr status`
- [x] PTY-based terminal recording with node-pty
- [x] Git before/after diff capture
- [x] Claude Code session parser
- [x] Codex CLI session parser
- [x] `aifr import` command
- [x] Web UI: Timeline, Diff, Replay, Prompt-to-Diff, Events views
- [x] Session format documentation

## v0.2 — Polish & Reliability

- [ ] CLI: `aifr replay` command (terminal replay in CLI)
- [ ] CLI: `aifr diff` command (inline diff in CLI)
- [ ] SQLite FTS search across sessions
- [ ] Cursor parser implementation
- [ ] Secret redaction hooks (detect tokens, keys, passwords)
- [ ] Session export (zip/archive)
- [ ] Prompt-to-Diff confidence scoring
- [ ] Test coverage for all packages

## v0.3 — Collaboration

- [ ] Shared session links (upload to cloud, opt-in)
- [ ] Team session viewer
- [ ] PR integration (attach session to GitHub PR)
- [ ] Session comparison (diff two sessions)
- [ ] Session templates (reusable recording configs)

## v0.4 — Intelligence

- [ ] AI-powered session summaries
- [ ] Pattern detection (common failure modes, retry patterns)
- [ ] Cost estimation (token usage, API calls)
- [ ] Session analytics dashboard

## Long-term

- [ ] Multi-agent orchestration recording
- [ ] Custom parser SDK
- [ ] Plugin system for extensions
- [ ] IDE integrations (VS Code, JetBrains)
- [ ] Enterprise features (SSO, audit logs, compliance)
