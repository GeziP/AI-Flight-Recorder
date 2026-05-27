# AIFR（AI Flight Recorder）

### TL;DR

AIFR 是一个面向 AI 辅助软件开发的过程观测平台，用于回放、检查和分析 AI 编程工作流。它记录的不是聊天记录，而是事件流，并将 Prompt、命令、代码 Diff、测试、重试和终端输出组织成可回放、可审计的执行图，服务于使用 Claude Code、Codex CLI、Cursor 以及其他终端型 Coding Agent 的开发者。

---

## Goals

### Business Goals

* 将 AIFR 打造成 AI 辅助软件开发领域的开源观测层，定位为 “OpenTelemetry for AI Software Development”。
* 发布聚焦的 v0.1 MVP，让开发者通过 `npx aifr` 一键安装使用，本地完成录制和回放。
* 从第一天开始支持 Claude Code 和 Codex CLI 导入，建立 AI 编程工具生态中的可信度。
* 通过执行图、Prompt-to-Diff 追踪和 Replay 能力形成差异化，而不是停留在聊天记录导出工具层面。
* 通过高质量 GitHub README、示例 session、核心截图和 MIT License 获取早期开源关注度。

### User Goals

* 在一次 AI 辅助编码结束后，快速理解真实发生了什么，而不需要从聊天记录、终端输出和 Git Diff 中手动还原过程。
* 回放一个开发 session，检查 Prompt、命令、文件变化、测试失败、重试路径和最终 Patch。
* 找到某个代码 Diff 是由哪个 Prompt 或 Agent 行为触发的。
* 对比失败尝试和成功尝试，理解问题是如何被修复的。
* 使用本地、开放、可检查的文件格式保存 AI 编程工作流记录。

### Non-Goals

* AIFR 不是 AI 聊天记录工具，也不是聊天导出查看器。
* v0.1 不做 RAG、Embedding、AI Summary、长期记忆或 Agent 编排。
* v0.1 不做企业协作、云同步、托管团队分析或复杂权限系统。

---

## User Stories

开发者

* 作为一名开发者，我希望能通过 CLI 开始录制一个编码 session，以便在和 AI Coding Agent 协作时捕获真实开发过程。
* 作为一名开发者，我希望能回放终端输出和命令执行过程，以便还原一个 session 的执行路径。
* 作为一名开发者，我希望看到 Prompt、命令、Diff、测试和重试组成的时间线，以便快速理解工作顺序。
* 作为一名开发者，我希望将 Prompt 映射到生成的代码 Diff，以便理解哪一次 AI 请求导致了哪些代码变化。
* 作为一名开发者，我希望所有记录默认保存在本地，以便避免敏感代码、Token 或终端输出被上传。

开源维护者

* 作为一名开源维护者，我希望检查一次 AI 辅助贡献背后的执行过程，以便更有信心地 Review PR。
* 作为一名开源维护者，我希望比较失败尝试和最终成功 Patch，以便判断最终方案是稳健修复还是偶然产物。
* 作为一名开源维护者，我希望 session artifact 使用开放格式存储，以便即使不依赖 AIFR UI 也可以审计和归档。
* 作为一名开源维护者，我希望快速查看最终 Patch 之前的测试失败和重试路径，以便降低 AI 生成代码的审查成本。

AI 工具开发者

* 作为一名 AI 工具开发者，我希望 Claude Code、Codex CLI、Cursor 和终端 session 能被归一化成统一事件模型，以便在其上构建更多工具。
* 作为一名 AI 工具开发者，我希望 Parser 和核心包使用 TypeScript 编写，以便更快理解、扩展和贡献。
* 作为一名 AI 工具开发者，我希望能访问原始事件和事件 Schema，以便构建自定义分析、可视化或集成。

---

## Functional Requirements

* CLI Session Management（Priority: P0）

  * 初始化项目：提供 `aifr init`，在当前 Git 仓库中创建本地 `.aifr/` 目录。
  * 开始 session：提供 `aifr start`，创建新 session，写入 metadata，捕获 Git baseline，并启动终端 recorder。
  * 回放 session：提供 `aifr replay`，回放指定 session 或最近 session 的事件流和终端输出。
  * 查看 Diff：提供 `aifr diff`，查看 session 中捕获的代码变化。
  * 状态检查：提供清晰的 CLI 输出，告诉用户当前 session 是否正在录制、输出目录在哪里、是否成功捕获 Git 状态。
  * 启动 Web UI：提供 `aifr ui`，自动启动 Web 服务器并打开浏览器，用户无需手动构建或配置。

* Event Stream Capture（Priority: P0）

  * 统一事件模型：将 Prompt、命令、Diff、工具调用、测试、重试、终端输出和 session 生命周期归一化为 JSONL 事件。
  * 事件持久化：将事件 append 到当前 session 目录下的 `events.jsonl`。
  * Session metadata：记录 session ID、项目路径、Agent 来源、开始和结束时间、Git commit 引用、操作系统和 shell 信息。
  * 终端录制：使用 `node-pty` 捕获命令执行与终端输出，用于后续 replay。
  * 事件顺序：所有事件必须包含 timestamp，并尽量保证同一 session 内的稳定排序。

* Agent Parsers（Priority: P0）

  * Claude Parser：读取 Claude Code 本地 session 路径 `~/.claude/projects/`，将原始记录标准化为 AIFR 事件。
  * Codex Parser：读取 Codex CLI 本地 session 路径 `~/.codex/sessions/`，将原始记录标准化为 AIFR 事件。
  * Cursor Parser 基础结构：先提供 `packages/parser-cursor` 包结构，待 Claude 和 Codex 核心流程稳定后再完善实现。
  * Parser fixtures：在 `examples/` 下提供脱敏样例 session，方便测试和贡献。

* Git Diff Timeline（Priority: P0）

  * Before/After 快照：在 session 开始和结束时捕获 Git Diff 状态。
  * Diff 事件：将关键文件变化转换为 DiffEvent，包含文件列表和 patch 内容。
  * Prompt-to-Diff Mapping：基于 timestamp、命令上下文、文件变化顺序和 session 顺序，将 Prompt 与相邻 Diff 建立关联。
  * Timeline Diff View：在 session 时间线中按时间顺序展示代码变化。
  * Baseline 处理：如果 session 开始前已有未提交改动，需要明确标记 baseline，避免把历史改动误归因到当前 Prompt。

* Web UI（Priority: P1）

  * 项目列表：展示本地已初始化 AIFR 的项目。
  * Session 列表：展示选中项目下的已录制 session。
  * Timeline View：展示 Prompt、命令、Diff、测试结果、重试和最终 Patch 进展。
  * Prompt-to-Diff View：展示某个 Prompt 及其可能生成或影响的文件变化。
  * Replay View：使用 xterm.js 回放终端输出和命令序列。
  * Diff Visualization：使用 diff2html 支持 side-by-side Diff 和 timeline Diff。
  * Event Detail Drawer：允许用户查看原始事件 payload，但该能力应作为高级调试功能，而不是主界面中心。

* Search and Inspection（Priority: P2）

  * 本地搜索：使用 SQLite FTS 搜索 Prompt、命令、文件名和事件内容。
  * Session 导出：允许用户复制或导出完整 session 目录，作为本地 artifact 保存。
  * Raw Event 检查：支持开发者查看、复制和调试标准化后的事件。
  * 隐私提示：在用户分享或导出 session 前提示其中可能包含敏感代码、Token、环境变量或终端输出。

## User Experience

Entry Point & First-Time User Experience

* 用户主要通过 GitHub 或 npm 发现 AIFR，第一屏定位必须非常明确：
  * AI Flight Recorder for Coding Agents
  * Record, replay, and analyze AI-assisted software development workflows
  * OpenTelemetry for AI Software Development
* README 第一屏必须有三张核心截图：
  * Timeline
  * Prompt-to-Diff
  * Replay
* 安装体验必须零摩擦：
  * `npx aifr init` — 无需安装，直接运行
  * `npm i -g aifr` — 全局安装后所有命令可用
  * Web UI 通过 `aifr ui` 一键启动，无需 clone 或手动构建
* 首次使用是 CLI-first：
  * 用户运行 `npx aifr init`（或全局安装后 `aifr init`）。
  * 用户进入一个 Git 仓库。
  * AIFR 创建 `.aifr/` 并确认项目已准备好。
* 用户有两种入口：
  * 导入已有 Claude Code 或 Codex CLI session。
  * 从当前终端开始录制新的 AI 编程工作流。
* v0.2 提供 VS Code 扩展入口：
  * 侧栏直接查看 session 列表、回放、diff，无需开浏览器。
  * 与编辑器深度集成：点击 diff 事件直接跳转到对应文件。

Core Experience

* Step 1: 在仓库中初始化 AIFR。

  * 用户运行 `aifr init`。
  * AIFR 创建 `.aifr/` 目录结构。
  * 如果当前目录不是 Git 仓库，AIFR 提示 Git Diff 捕获能力会受限。
  * 成功状态需要告诉用户下一步可以运行 `aifr start`。

* Step 2: 开始新的 session。

  * 用户运行 `aifr start`。
  * AIFR 在 `.aifr/sessions/` 下创建 timestamp 命名的 session 目录。
  * AIFR 写入 `metadata.json`。
  * AIFR 捕获初始 Git Diff 或 baseline 快照。
  * AIFR 使用 `node-pty` 启动终端 recorder。
  * 用户像平时一样使用 Claude Code、Codex CLI、Cursor 或其他终端型 Coding Agent。

* Step 3: 捕获事件流。

  * AIFR 将结构化事件持续写入 `events.jsonl`。
  * 事件包括 Prompt、命令、Diff、工具调用、测试结果、Retry、终端输出和 session 生命周期。
  * Event Stream 是产品的核心资产。
  * Chat Transcript 不是核心抽象，也不应该驱动产品模型。

* Step 4: 查看 session timeline。

  * 用户打开 Web UI 或 CLI replay。
  * AIFR 展示按时间排序的 session timeline，例如：
    * 10:01 Prompt
    * 10:02 grep command
    * 10:03 modify `scheduler.cpp`
    * 10:04 tests failed
    * 10:05 retry
    * 10:06 tests pass
  * 用户可以点击任意事件查看详情。
  * Timeline 需要让用户一眼看出 session 的执行脉络，而不是仅展示原始日志。

* Step 5: 查看 Prompt-to-Diff 映射。

  * 用户选择一个 Prompt，例如 “refactor scheduler”。
  * AIFR 展示相关文件变化，例如 `scheduler.cpp`、新增行数、删除行数和 patch 详情。
  * 这是最重要的产品交互，因为它回答了“意图如何变成代码”。
  * 如果映射是推断出来的，UI 应该标记 confidence 或使用“likely related changes”这样的表达，避免过度承诺。

* Step 6: 回放执行过程。

  * 用户进入 Replay。
  * AIFR 使用 xterm.js 播放终端输出、命令执行和事件进度。
  * 体验应类似 asciinema，但比 asciinema 多了 AI 工作流结构。
  * 用户可以暂停、加速、跳到某个事件、跳到某个 Diff。

* Step 7: Review 最终 Patch 和 Retry Path。

  * 用户比较第一次失败、Retry 行为、最终测试通过和最终 Patch。
  * AIFR 突出展示执行图：Prompt → Command → Diff → Retry → Test → Final Patch。
  * 这个视图应该帮助用户判断 AI 生成代码是否可信、是否经过有效验证。

Advanced Features & Edge Cases

* 导入的 session 可能缺少 timestamp、命令上下文或 Agent metadata。
* 终端输出可能包含 secret、Token、私有代码或环境变量，分享前必须有明确警告。
* 如果录制开始前仓库已有未提交改动，AIFR 必须清楚标记 baseline。
* 大型 Diff 默认折叠，按文件展开，避免页面被巨量 patch 淹没。
* 失败的 session 也必须有价值，能够被 replay 和分析。
* 一个仓库中可能混用多个 Agent，v0.1 应清晰展示来源，但不做复杂 Multi-Agent Orchestration。
* Windows、macOS、Linux 的 shell 行为不同，node-pty 兼容性需要明确验证。

UI/UX Highlights

* 主导航模型为 Projects → Sessions → Timeline。
* 核心视觉对象是 Execution Graph：Prompt → Command → Diff → Retry → Test → Final Patch。
* Prompt-to-Diff View 的优先级高于 Raw Chat View。
* Diff View 需要支持 side-by-side 和 timeline 两种模式。
* Replay 控件至少包括 play、pause、speed、jump to event 和 jump to diff。
* Raw Event Inspection 可以提供，但必须退居二级，服务于调试和扩展。
* UI 风格应是开发者工具风格：信息密度高、可读性强、键盘友好、适合代码 Review。
* 空状态要非常清楚地告诉用户下一步命令，例如 `aifr init`、`aifr start`、`aifr import claude`。

---

## Narrative

一名开发者正在使用 AI Coding Agent 修复一个复杂的并发问题。聊天记录里有多轮 Prompt，但聊天本身并不能解释真实发生了什么：哪些命令被执行了，哪些文件被修改了，哪些测试失败了，哪一次 Retry 真正修复了问题，以及最终 Patch 是否真的来源于最初的需求。Session 结束后，开发者需要 Review 这次修改，向维护者解释变更原因，并判断 AI 生成的方案是否可信。

AIFR 不把这次过程记录成聊天导出，而是记录成事件流。当开发者开始 session 后，AIFR 会在本地捕获 Prompt、终端命令、代码 Diff、测试结果、Retry 和终端输出，并将它们写入一个可检查的 session 目录。在 Web UI 中，开发者看到的是一条清晰的 Timeline，可以从某个 Prompt 直接跳到它可能产生的 Diff。Replay 展示终端过程如何展开，Diff Timeline 展示代码如何一步步变化。

最终，AIFR 为 AI 辅助开发提供了一张执行图。开发者可以调试自己的 AI 工作流，维护者可以更有信心地 Review AI 辅助提交，AI 工具开发者也能基于开放事件格式构建新的分析和集成。AIFR 的价值不是保存聊天，而是成为 AI 软件开发过程的观测层。

---

## Success Metrics

### User-Centric Metrics

* Time to first recorded session：从安装到完成第一个 `aifr start` session 的中位时间低于 10 分钟。
* One-click install success rate：`npx aifr init` 在首次尝试中成功执行的比例达到 95%。
* npm weekly downloads：发布后 4 周内周下载量达到 500+。
* Replay usage：至少 50% 完成录制的用户会打开 Replay 或 Timeline。
* Prompt-to-Diff usage：至少 40% 被检查的 session 中发生至少一次 Prompt-to-Diff 查看行为。
* Developer satisfaction：早期用户对 session inspection 有用性的评分达到 4/5 或更高。
* Repeat usage：早期用户在一周内录制 2 个或更多 session 的比例持续上升。

### Business Metrics

* GitHub traction：通过 stars、forks、issues、external mentions 获得明确早期开源验证。
* Ecosystem adoption：收到来自 Claude、Codex 之外的 Parser 或集成需求。
* Contributor activation：早期用户开始贡献 Parser、examples、文档或 UI 改进。
* Positioning validation：用户在反馈中使用 observability、replay、execution tracing 等词描述 AIFR，而不是 chat export。
* README conversion：访问 GitHub 后执行安装或运行示例的用户比例持续提升。

### Technical Metrics

* Event write reliability：本地录制时事件 append 成功率达到 99% 或更高。
* Replay integrity：95% 或更高的已捕获 session 可以在不破坏事件顺序的情况下回放。
* Parser success：Claude 和 Codex Parser 能成功导入仓库中的代表性 example session。
* Local performance：典型 session 即使包含数千个事件，Timeline 加载时间仍低于 2 秒。
* Diff rendering performance：大型 Diff 默认折叠后页面交互保持流畅。

### Tracking Plan

* 记录 `aifr_init_started` 和 `aifr_init_completed`。
* 记录 `session_started`、`session_completed` 和 `session_failed`。
* 按类型记录事件数量：prompt、command、diff、test、retry、terminal_output、session。
* 记录 `replay_opened`、`replay_started`、`replay_paused` 和 `replay_completed`。
* 记录 `timeline_opened` 和 `timeline_event_selected`。
* 记录 `prompt_to_diff_opened` 以及被选择的 Prompt/Diff 关系。
* 记录 Claude 和 Codex Parser 的 import attempt、success、failure reason。
* 所有离开本机的 telemetry 必须显式 opt-in；默认不上传用户代码、Prompt、终端输出或 Diff 内容。

---

## Technical Considerations

### Technical Needs

* 推荐仓库结构：

```text
aifr/
├── README.md
├── LICENSE
├── .gitignore
├── docs/
│   ├── architecture.md
│   ├── roadmap.md
│   ├── session-format.md
│   └── screenshots/
│
├── apps/
│   ├── cli/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── commands/
│   │   │   ├── recorder/
│   │   │   ├── parsers/
│   │   │   └── git/
│   │
│   └── web/
│       ├── package.json
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── public/
│
├── packages/
│   ├── core/
│   ├── parser-claude/
│   ├── parser-codex/
│   ├── parser-cursor/
│   ├── event-schema/
│   └── replay-engine/
│
├── examples/
│   ├── claude-session/
│   ├── codex-session/
│   └── cursor-session/
│
└── scripts/
    ├── install.ps1
    └── install.sh
```

* 推荐技术栈：

| 层 | 技术 |
| --- | --- |
| CLI | Node.js + TypeScript |
| Web | Next.js |
| UI | Tailwind + shadcn |
| Replay | xterm.js |
| DB | SQLite |
| Events | JSONL |
| Git | simple-git |
| Terminal | node-pty |
| Diff | diff2html |
| Search | SQLite FTS |

* 起步阶段不建议使用 Go 或 Rust，因为当前最重要的是快速吃到 JavaScript/TypeScript 生态，而不是极致性能。
* npm 分发策略：
  * `apps/cli` 作为 npm 发布入口，包名 `aifr`。
  * `bin` 字段指向编译后的 CLI 入口（支持 CJS 和 ESM）。
  * `node-pty` 为 optional dependency，安装失败不阻塞其余功能。
  * Web UI 构建为 Next.js standalone 产物，随 CLI 包一起分发，`aifr ui` 启动内嵌服务器。
  * 使用 GitHub Actions CI，tag push 自动触发 `npm publish`。
* VS Code 扩展分发（v0.2）：
  * 扩展独立仓库或在 monorepo 中新增 `apps/vscode/`。
  * 通过 VS Code Marketplace 和 Open VSX 发布。
  * 复用 Web UI 组件和核心包，通过 Webview API 渲染。
* `packages/core` 负责核心转换：Session → Event Stream。
* `packages/event-schema` 负责统一事件类型。
* 初始事件模型应包括：
  * PromptEvent
  * CommandEvent
  * DiffEvent
  * ToolEvent
  * TestEvent
  * SessionEvent
  * TerminalOutputEvent
  * RetryEvent
* 示例事件模型：

```ts
export type Event =
  | PromptEvent
  | CommandEvent
  | DiffEvent
  | ToolEvent
  | TestEvent
  | SessionEvent;

```

`export interface BaseEvent {`  

`id: string;`  

`sessionId: string;`  

`timestamp: number;`  

`}`

`export interface PromptEvent extends BaseEvent {`  

`type: "prompt";`  

`agent: "claude" | "codex" | "cursor";`  

`content: string;`  

`}`

`export interface CommandEvent extends BaseEvent {`  

`type: "command";`  

`command: string;`  

`cwd: string;`  

`}`

`export interface DiffEvent extends BaseEvent {`  

`type: "diff";`  

`files: string[];`  

`patch: string;`  

`}`  

### Integration Points

* Claude Code 本地 session：`~/.claude/projects/`。
* Codex CLI 本地 session：`~/.codex/sessions/`。
* Cursor session 支持在 v0.1 基础稳定后推进。
* Git 仓库集成通过 simple-git 完成。
* 本地终端录制通过 node-pty 完成。
* Web Replay 通过 xterm.js 完成。
* Diff 可视化通过 diff2html 完成。
* 本地索引和搜索通过 SQLite 与 SQLite FTS 完成。

### Data Storage & Privacy

* AIFR 默认 local-first。
* Session artifact 存储在 `.aifr/sessions/{timestamp}/`。
* 预期 session 结构：

```text
.aifr/
 └── sessions/
      └── 20260526_120011/
           ├── events.jsonl
           ├── terminal.log
           ├── metadata.json
           ├── git/
           │    ├── before.patch
           │    └── after.patch
           └── replay/
```

* Event Stream 使用 JSONL，因为它 append-friendly、易读、易调试，也便于其他工具处理。
* SQLite 在 v0.1 中可以作为索引层和查询层，但不应替代 JSONL 作为 canonical event artifact。
* 终端输出、Prompt、Diff 和 metadata 可能包含密钥、Token、私有代码、内部路径或隐私信息。
* 分享、导出或上传前必须有明确风险提示。
* 任何远程 analytics、云同步或分享能力都必须显式 opt-in。

### Scalability & Performance

* v0.1 优先优化本地开发者工作流，而不是大型托管企业场景。
* Timeline 应能流畅处理数千个事件；必要时使用虚拟列表或增量加载。
* 大型 terminal log 应按 chunk 流式读取和播放。
* 大型 Diff 应按文件折叠，用户需要时再展开。
* Event append 必须稳定、低延迟，不能显著影响用户正常编码。
* Parser 应尽量容错，面对字段缺失或格式变化时输出可诊断错误，而不是静默失败。

### Potential Challenges

* Claude、Codex、Cursor 的本地 session 格式可能随版本变化，Parser 需要明确兼容策略。
* Prompt-to-Diff Mapping 在 timestamp 或命令上下文缺失时只能是概率推断，UI 和文档不能过度承诺精确归因。
* node-pty 在不同操作系统、shell 和终端环境下表现不完全一致。
* Windows 支持需要特别验证，因为 PowerShell、路径格式和 PTY 行为可能带来额外问题。
* Secret 泄露是严重风险，早期至少要提供警告，后续应提供 redaction hooks。
* 产品很容易被误解为 chat recorder，因此 README、截图、命令和 UI 文案必须持续强调 event stream 和 execution graph。
* 如果 Web UI 过早复杂化，会拖慢核心录制和 Prompt-to-Diff 闭环，v0.1 应优先保证核心闭环可用。

---

## Milestones & Sequencing

### Project Estimate

Medium：v0.1（Phase 1–5）2–4 周完成；Phase 6（npm 发布）额外 3–4 天；v0.2（Phase 7 VS Code 扩展）额外 7–10 天。

### Team Size & Composition

Small team：2–3 人。

* 产品/工程负责人：负责产品范围、架构决策、CLI 主流程、事件 Schema 和开源定位。
* Full-stack Engineer：负责 Web UI、Replay View、Diff Visualization、本地索引和基础搜索。
* Design/Product Contributor，可兼职：负责 README 第一屏、截图质量、开发者体验和文案清晰度。

### Suggested Phases

Phase 1: Core Event Model and CLI Skeleton（3–5 天）

* Key Deliverables:  
  * 产品/工程负责人定义 `packages/event-schema`。
  * 产品/工程负责人创建 `packages/core` 的 Session → Event Stream 核心流程。
  * CLI 支持 `aifr init` 并能创建 `.aifr/`。
  * Monorepo 按目标结构完成 scaffold。
  * 写出 `docs/session-format.md` 初版。
* Dependencies:  
  * 确认 canonical event schema。
  * 完成基本 Git 仓库检测。

Phase 2: Recording and Git Timeline MVP（5–7 天）

* Key Deliverables:  
  * CLI 支持 `aifr start`。
  * node-pty 终端录制可用。
  * 事件持续写入 `events.jsonl`。
  * 捕获 Git before/after patch。
  * CLI 支持基础 `aifr diff` 和 `aifr replay`。
  * Session 目录结构稳定。
* Dependencies:  
  * 明确 session lifecycle。
  * 至少在主开发操作系统上完成终端录制验证。

Phase 3: Claude and Codex Imports（4–6 天）

* Key Deliverables:  
  * `packages/parser-claude` 可从 `~/.claude/projects/` 导入代表性 Claude Code session。
  * `packages/parser-codex` 可从 `~/.codex/sessions/` 导入代表性 Codex session。
  * `examples/` 下加入脱敏样例。
  * Parser 输出完全符合统一事件 Schema。
  * Parser 错误信息可诊断，便于社区贡献修复。
* Dependencies:  
  * 获得真实或代表性的本地 session 样本。
  * 样本必须脱敏，不能包含私有代码或 secret。

Phase 4: Web UI and Screenshot-Ready Product Loop（5–7 天）

* Key Deliverables:  
  * Next.js Web App 展示 Projects → Sessions → Timeline。
  * Timeline 展示 Prompt、Command、Diff、Retry、Test 和 Terminal Output marker。
  * Prompt-to-Diff View 展示所选 Prompt 及相关 Patch。
  * Replay View 使用 xterm.js。
  * Diff View 使用 diff2html。
  * README 包含定位、安装方式、支持 Agent、核心功能和前三张截图。
* Dependencies:  
  * 已有可工作的本地 session examples。
  * Replay engine interface 基本稳定。

Phase 5: Polish, Open-source Release, and Feedback Loop（2–4 天）

* Key Deliverables:
  * 添加 MIT License。
  * 文档包含 architecture、roadmap、session-format。
  * 提供 macOS/Linux 和 Windows 安装脚本。
  * 明确记录 known limitations。
  * Tag v0.1 release 并发布。
  * 收集 GitHub issues、社区反馈和 Parser 请求。
* Dependencies:
  * 完成最低限度跨平台 QA。
  * 本地录制不存在明确数据丢失问题。
  * README 第一屏能准确传达：AIFR 不是聊天记录工具，而是 AI 开发过程观测平台。

Phase 6: npm Publishing & One-Click Install（3–4 天）

* Key Deliverables:
  * 将 CLI 发布到 npm registry（包名 `aifr`），支持 `npx aifr` 和 `npm i -g aifr`。
  * 实现 `aifr ui` 命令：内嵌 Next.js 构建产物，一键启动 Web UI 并自动打开浏览器。
  * CLI 的 `node-pty` 依赖处理为 optional dependency，npm install 失败时降级提示而不阻塞安装。
  * 构建 pipeline：`pnpm build` 后自动将 `apps/web/.next/` standalone 输出和 CLI 产物打包到 `apps/cli/` 发布目录。
  * README 更新安装方式为 `npx aifr init`，移除 clone + pnpm install 的手动步骤。
  * CI 自动发布：tag push 触发 `npm publish`，确保版本号一致。
* Dependencies:
  * Phase 4 Web UI 稳定可用。
  * CLI 所有命令在全局安装模式下路径解析正确。
  * `node-pty` 在主流平台（macOS、Linux、Windows）的 prebuilt binary 可用。
* Technical Considerations:
  * 使用 Next.js `output: 'standalone'` 将 Web UI 构建为自包含产物，避免运行时依赖 `node_modules`。
  * `apps/cli/package.json` 的 `bin` 字段指向编译后的入口文件。
  * `node-pty` 标记为 `optionalDependencies`，install 失败时 `aifr start` 降级为无终端录制模式，其余命令正常工作。
  * 使用 `tsup` 将 CLI 编译为单文件 CJS + ESM 双格式输出。

Phase 7: VS Code Extension（v0.2，7–10 天）

* Key Deliverables:
  * 发布 VS Code 扩展 `aifr-vscode`，在侧栏显示项目 session 列表。
  * 内嵌 Webview 实现 Timeline、Replay、Diff 视图，复用 Web UI 组件。
  * 点击 diff 事件跳转到编辑器对应文件和行号。
  * 点击 session 自动启动内置 replay，无需外部浏览器。
  * 提供快捷命令：`AIFR: Import Session`、`AIFR: Open Timeline`、`AIFR: Start Recording`。
  * VS Code Marketplace 发布，支持一键安装。
* Dependencies:
  * Phase 6 npm 发布完成，CLI 可作为 dependency 被 extension 调用。
  * Web UI 组件可独立打包为 Webview 消费的 JS bundle。
* Technical Considerations:
  * Extension 使用 VS Code Webview API，通过 iframe 加载 Web UI 页面或打包后的 JS bundle。
  * 复用 `@aifr/event-schema` 和 `@aifr/core` 包，避免逻辑重复。
  * Session 发现逻辑复用 `session-discovery.ts`，通过 extension host 的 Node.js 环境运行。
  * 文件跳转通过 VS Code `workspace.openTextDocument` + `TextEditor.revealRange` API 实现。