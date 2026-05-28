# AIFR v0.2 Phase 1: Execution Graph & Analysis Data Model

## Context

AIFR v0.1 完成了录制、导入、回放和 Diff Timeline。v0.2 的目标是从"能录、能看、能回放"升级到"能解释、能审计、能复盘"。Phase 1 是 v0.2 的基础：将 events.jsonl 转化为结构化 Execution Graph 和语义分析结果，为后续 Report、Redaction、Web UI 新视图提供数据层。

Phase 1 的产出是两个派生 artifact（graph.json、analysis.json）和两个 CLI 命令（aifr graph、aifr analyze），不涉及 Web UI 改动。

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 归因引擎 | 纯规则 + 时序窗口 | 确定性、可调试、不依赖外部 LLM。Claude Code CLI 接入作为未来可选扩展点预留接口，v0.2 不实现 |
| Graph 可视化 | React Flow（Phase 4 Web UI） | Phase 1 只输出 graph.json 数据，不做可视化 |
| Artifact 存放 | 沿用 v0.1 session 目录 | graph.json、analysis.json 放在 `.aifr/sessions/{id}/` 下，跟原始数据在一起 |
| Redaction | 正则模式匹配 | Phase 3 实现，Phase 1 只在数据模型中预留 source 字段 |
| followed_by 边 | 不持久化 | 仅内存中使用，辅助布局计算。graph.json 只存有语义的边类型 |
| metadata 读取 | analyzer 直接读 JSON | 不依赖 @aifr/core，metadata.json 是简单 JSON 文件 |

## Data Model

### graph.json

```ts
interface ExecutionGraph {
  schemaVersion: '0.2.0';
  sessionId: string;
  generatedAt: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: string[];
}

interface GraphNode {
  id: string;              // 'node_0', 'node_1', ...
  type: NodeType;
  eventIds: string[];      // 指向 events.jsonl 中的原始事件
  label: string;           // 人类可读摘要
  timestamp: number;       // 节点开始时间
  timestampEnd?: number;   // 合并节点的结束时间，单事件节点不设
  metadata: Record<string, unknown>;
}

type NodeType = 'prompt' | 'command' | 'diff' | 'test' | 'tool' | 'terminal' | 'retry' | 'session';

interface GraphEdge {
  id: string;              // 'edge_0', 'edge_1', ...
  from: string;            // node id
  to: string;              // node id
  type: EdgeType;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];      // 推断依据描述
  source: 'inferred' | 'manual';
}

type EdgeType = 'caused_by' | 'produced_patch' | 'verified_by' | 'failed_then_retry';
// Note: 'followed_by' and 'modified' exist in memory only, not persisted to graph.json
```

### EventType → NodeType mapping

```ts
const EVENT_TO_NODE_TYPE: Record<string, NodeType> = {
  prompt: 'prompt',
  command: 'command',
  diff: 'diff',
  test: 'test',
  tool: 'tool',
  terminal_output: 'terminal',
  retry: 'retry',
  session: 'session',
};
```

### analysis.json

```ts
interface SessionAnalysis {
  schemaVersion: '0.2.0';
  sessionId: string;
  generatedAt: number;
  attribution: AttributionSummary;
  retryGroups: RetryGroup[];
  summary: SessionSummary;
  warnings: string[];
}

interface AttributionSummary {
  totalDiffs: number;
  attributed: number;         // 有至少一个候选 prompt 的 diff 数
  unattributed: number;       // 无候选的 diff 数
  byConfidence: { high: number; medium: number; low: number };
}

// 具体 prompt→diff 映射查 graph.json 中 type='caused_by' 且 from 为 prompt 节点、to 为 diff 节点的 edge

interface RetryGroup {
  id: string;
  failureNodeId: string;
  fixNodeIds: string[];      // 窗口内的所有 prompt/diff/command 节点
  successNodeId?: string;
  hotspotFiles: string[];
}

interface SessionSummary {
  agent: string;
  duration: number;
  totalPrompts: number;
  totalCommands: number;
  totalDiffFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  testsPassed: number;
  testsFailed: number;
  retryCount: number;
  hasBaselineDiff: boolean;   // events.jsonl 中是否有 isBaseline:true 的 DiffEvent
}
```

## Package Structure

```
packages/
  graph-builder/
    src/
      builder.ts          # 核心构建器：events → ExecutionGraph
      node-extractor.ts   # 事件 → GraphNode 映射 + 合并
      edge-inferencer.ts  # 规则引擎：推断节点间边（三阶段）
      index.ts
    test/
      builder.test.ts
      node-extractor.test.ts
      edge-inferencer.test.ts
      fixtures/           # 手构造 events 数组 JSON
    package.json          # @aifr/graph-builder
    tsup.config.ts

  analyzer/
    src/
      analyzer.ts         # 核心分析器：graph + events → SessionAnalysis
      retry-detector.ts   # 失败/重试检测与分组
      summary.ts          # SessionSummary 生成
      index.ts
    test/
      analyzer.test.ts
      retry-detector.test.ts
    package.json          # @aifr/analyzer
    tsup.config.ts
```

**依赖链**：`@aifr/event-schema` ← `@aifr/core` ← `@aifr/graph-builder` ← `@aifr/analyzer`

- graph-builder 只依赖 event-schema（类型校验）
- analyzer 依赖 graph-builder（类型输出）+ event-schema，不依赖 core
- analyzer 直接用 `fs.readFile` 读 metadata.json，不通过 core
- attribution 逻辑已合并到 graph-builder 的 edge-inferencer 中（prompt→diff 边就是归因结果）
- analyzer 只做聚合统计（attribution summary）和 retry 检测

## CLI Commands

```bash
aifr graph [session-id]       # 构建 Execution Graph
aifr graph --all              # 对所有 session 批量构建
aifr graph --no-overwrite     # 跳过已有 graph.json 的 session

aifr analyze [session-id]     # 运行完整分析（自动构建 graph 如缺失）
aifr analyze --all            # 对所有 session 批量分析
aifr analyze --no-overwrite   # 跳过已有 analysis.json 的 session
```

无 session-id 参数时对最新 session 操作。输出到 `.aifr/sessions/{id}/graph.json` 和 `.aifr/sessions/{id}/analysis.json`。

在 `apps/cli/src/commands/` 新增 `graph.ts` 和 `analyze.ts`。

## Core Algorithms

### Node Extractor

每条事件通过 EVENT_TO_NODE_TYPE 映射为 GraphNode。合并策略：

| Scenario | Rule |
|----------|------|
| 连续 TerminalOutput，间隔 < 2s | 合并为一个 terminal 节点 |
| 连续 ToolEvent 同名工具 | 合并，eventIds 累加 |
| 同一 Prompt 内多轮 assistant 回复 | 不合并，每条独立 |
| DiffEvent 包含多文件 | 不拆分，metadata 存 files 列表 |

合并节点时设置 `timestampEnd` 为最后一个事件的 timestamp。

label 生成：
- prompt: 截取前 80 字符
- command: 原始命令字符串
- diff: `modified N files (+A/-D)`
- test: `test {name}: {pass/fail}`
- terminal: `terminal output ({N} lines)`

### Edge Inferencer（三阶段）

#### Phase A — 基础边

**Rule 1 — Prompt → Command（caused_by）**
- Condition: command.timestamp 在 prompt.timestamp 后 60s 内
- Confidence: high（< 10s）或 medium
- Evidence: `"Command '{cmd}' started {Δt}s after prompt"`

**Rule 2 — Command → Diff（produced_patch）**
- Condition: diff.timestamp 在 command.timestamp 后 30s 内，command 涉及文件操作（grep/sed/write/edit/测试命令等关键词匹配）
- Confidence: high
- Evidence: `"Diff detected {Δt}s after command '{cmd}'"`

**Rule 5 — Diff → Test（verified_by）**
- Condition: test 在 diff 后 60s 内
- Confidence: high
- Evidence: `"Test ran {Δt}s after diff"`

**Rule 6 — Test(fail) → next Prompt/Diff（failed_then_retry）**
- Condition: test 结果为 fail，后续存在新的 prompt 或 diff
- Confidence: high
- Evidence: `"Retry after test failure: {test name}"`

#### Phase B — 链式归因

基于 Phase A 的边，找 `prompt →(caused_by)→ command →(produced_patch)→ diff` 完整路径。

**Rule 3 — Prompt → Diff（caused_by，链式归因）**
- Condition: 通过 Rule 1 + Rule 2 链式成立，中间无其他 prompt
- Confidence: high
- Evidence: 通过中间 command 的 evidence 链接

#### Phase C — 兜底归因

仅对 Phase B 没覆盖到的 diff 节点执行。

**Rule 4 — Prompt → Diff（caused_by，时间窗口归因）**
- Condition: diff 在 prompt 后 120s 内，无其他 prompt 更接近该 diff
- Confidence: low
- Evidence: `"Diff within {Δt}s of prompt, no intermediate command"`

#### followed_by（不持久化）

所有相邻节点（按时间排序，间隔 < 5min）在内存中加 followed_by 边，用于辅助布局计算和 fallback 逻辑。不写入 graph.json。

### Retry Detector

1. 扫描 test 和 command 节点，找退出码非零或 fail 的
2. 从每个失败节点向后搜索，搜索窗口为 300s
3. 窗口内的 prompt/diff/command 都纳入 fixNodeIds（允许中间插入无关事件）
4. 窗口内后续 test 为 pass 时标记为 RetryGroup，该 test 节点为 successNodeId
5. 统计每个文件在所有 retry 路径中出现次数，top-N 为 hotspotFiles

## Error Handling

| Scenario | Handling |
|----------|----------|
| events.jsonl 为空或不存在 | 报错退出：`No events found for session {id}` |
| 事件缺少 timestamp | 跳过，warning：`Event {id} missing timestamp, skipped` |
| 事件缺少 type | 跳过，warning |
| 事件 type 未知 | 作为 tool 节点兜底，metadata 保留原始数据 |
| graph.json 已存在 | 默认覆盖，`--no-overwrite` 跳过 |
| 用户手动修正过映射 | 重新分析时保留 `source: 'manual'` 的边，不覆盖 |
| 无 test 事件 | summary 中 testsPassed/testsFailed 为 0，warning 提示 |
| 无 git diff | 无 diff 节点，归因跳过，warning 提示 |

## Testing

**graph-builder 单元测试：**
- 从手构造 events 数组构建 graph，验证节点数量、边数量和类型
- 连续 TerminalOutput 合并，验证 timestampEnd 设置
- 孤立事件（无相邻事件）无边
- 空事件列表 → 空 graph + warning
- 三阶段边推断：验证 Phase A 基础边 → Phase B 链式边 → Phase C 兜底边的正确顺序
- 链式归因优先于时间窗口归因

**analyzer 单元测试：**
- AttributionSummary 统计：验证 totalDiffs/attributed/unattribured/byConfidence 正确
- Retry：test fail → 300s 窗口内 prompt/diff → test pass → RetryGroup 生成
- Retry 窗口外的事件不被纳入
- 无 test：summary 正常，warnings 提示
- hasBaselineDiff 从 events.jsonl 中检查 isBaseline:true 的 DiffEvent

**集成测试：**
- 读取 examples/ 下真实脱敏 session，端到端验证 graph.json + analysis.json 格式正确
- aifr graph 和 aifr analyze CLI 命令在真实 session 目录上运行

**fixture：**
- `packages/graph-builder/test/fixtures/` 下 3-5 个手构造 events 数组 JSON
- examples/ 下至少 1 个完整 Claude session 和 1 个 Codex session

## CLI Output

```
$ aifr graph
Building execution graph for session 20260526_120011...

  Nodes: 47  Edges: 62  Warnings: 2
  ✓ Saved to .aifr/sessions/20260526_120011/graph.json

  Warnings:
    - Event evt_14 missing timestamp, skipped
    - No test events captured

$ aifr analyze
Analyzing session 20260526_120011...

  Summary:
    Prompts: 8  Commands: 12  Files changed: 5
    +234/-89  Tests: 3 pass / 1 fail  Retries: 1

  Attribution:
    6 diffs: 4 high / 1 medium / 1 low / 2 unattributed

  Retry Analysis:
    1 retry group detected
    Hotspot files: src/scheduler.ts (modified 3 times)

  ✓ Saved to .aifr/sessions/20260526_120011/analysis.json
```
