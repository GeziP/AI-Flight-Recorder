import type { ExecutionGraph, GraphNode, GraphEdge } from '@aifr/graph-builder';
import type { AIFREvent, PromptEvent, DiffEvent, TestEvent } from '@aifr/event-schema';
import type { SessionAnalysis, RetryGroup } from './types.js';

export interface ReportOptions {
  maxTimelineEntries?: number;
  maxPromptLength?: number;
}

const DEFAULT_OPTIONS: ReportOptions = {
  maxTimelineEntries: 50,
  maxPromptLength: 200,
};

export function generateReport(
  graph: ExecutionGraph,
  analysis: SessionAnalysis,
  events: AIFREvent[],
  options?: ReportOptions,
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  const s = analysis.summary;
  const sessionId = graph.sessionId;
  const date = new Date(graph.generatedAt).toISOString().replace('T', ' ').slice(0, 19);

  lines.push(`# Session Review Report`);
  lines.push('');
  lines.push(`**Session**: \`${sessionId}\`  `);
  lines.push(`**Agent**: ${s.agent}  `);
  lines.push(`**Generated**: ${date}  `);
  if (s.duration > 0) {
    lines.push(`**Duration**: ${formatDuration(s.duration)}  `);
  }
  lines.push('');

  // Summary
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| User Prompts | ${s.totalPrompts} |`);
  lines.push(`| Commands | ${s.totalCommands} |`);
  lines.push(`| Files Changed | ${s.totalDiffFiles} |`);
  lines.push(`| Code Changes | +${s.totalAdditions} / -${s.totalDeletions} |`);
  lines.push(`| Tests Passed | ${s.testsPassed} |`);
  lines.push(`| Tests Failed | ${s.testsFailed} |`);
  lines.push(`| Retry Groups | ${s.retryCount} |`);
  lines.push(`| Baseline Diff | ${s.hasBaselineDiff ? 'Yes' : 'No'} |`);
  lines.push('');

  // Attribution
  lines.push(`## Prompt-to-Diff Attribution`);
  lines.push('');
  const a = analysis.attribution;
  lines.push(`- **${a.totalDiffs}** diffs detected (${a.attributed} attributed, ${a.unattributed} unattributed)`);
  lines.push(`- Confidence: ${a.byConfidence.high} high / ${a.byConfidence.medium} medium / ${a.byConfidence.low} low`);
  lines.push('');

  // Prompt → Diff mappings
  const mappings = extractPromptToDiffMappings(graph, events, opts.maxPromptLength ?? 200);
  if (mappings.length > 0) {
    lines.push(`### Mappings`);
    lines.push('');
    lines.push(`| # | Prompt | → Diff | Confidence |`);
    lines.push(`|---|--------|--------|------------|`);
    for (const m of mappings) {
      lines.push(`| ${m.index} | ${m.promptLabel} | ${m.diffLabel} | ${m.confidence} |`);
    }
    lines.push('');
  }

  // Retry Analysis
  if (analysis.retryGroups.length > 0) {
    lines.push(`## Retry Analysis`);
    lines.push('');
    for (const rg of analysis.retryGroups) {
      lines.push(`### Retry Group: ${rg.id}`);
      lines.push('');
      lines.push(`- **Failure**: ${rg.failureNodeId}`);
      lines.push(`- **Fix attempts**: ${rg.fixNodeIds.length} node(s)`);
      lines.push(`- **Resolved**: ${rg.successNodeId ?? 'No'}`);
      if (rg.hotspotFiles.length > 0) {
        lines.push(`- **Hotspot files**: ${rg.hotspotFiles.map(f => `\`${f}\``).join(', ')}`);
      }
      lines.push('');
    }
  }

  // Execution Timeline
  lines.push(`## Execution Timeline`);
  lines.push('');
  const timeline = buildTimeline(graph, events, opts.maxTimelineEntries ?? 50);
  lines.push(`| Time | Type | Label |`);
  lines.push(`|------|------|-------|`);
  for (const entry of timeline) {
    lines.push(`| ${entry.time} | ${entry.type} | ${entry.label} |`);
  }
  lines.push('');

  // Warnings
  if (analysis.warnings.length > 0) {
    lines.push(`## Warnings`);
    lines.push('');
    for (const w of analysis.warnings) {
      lines.push(`- **[${w.code}]** ${w.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

interface PromptDiffMapping {
  index: number;
  promptLabel: string;
  diffLabel: string;
  confidence: string;
}

function extractPromptToDiffMappings(
  graph: ExecutionGraph,
  events: AIFREvent[],
  maxPromptLength: number,
): PromptDiffMapping[] {
  const nodeMap = new Map<string, GraphNode>();
  for (const n of graph.nodes) nodeMap.set(n.id, n);

  const promptNodes = graph.nodes.filter(n => n.type === 'prompt' && n.metadata.role === 'user');
  const promptLabels = new Map<string, string>();
  for (const pn of promptNodes) {
    const evt = events.find(e => e.id === pn.eventIds[0]) as PromptEvent | undefined;
    const content = evt?.content ?? pn.label;
    promptLabels.set(pn.id, truncate(content.replace(/\n/g, ' '), maxPromptLength));
  }

  const causedByEdges = graph.edges.filter(e => e.type === 'caused_by');
  const mappings: PromptDiffMapping[] = [];
  let idx = 1;

  for (const diffNode of graph.nodes) {
    if (diffNode.type !== 'diff' || diffNode.metadata.isBaseline === true) continue;
    const edgesToDiff = causedByEdges.filter(e => e.to === diffNode.id);
    if (edgesToDiff.length === 0) continue;

    const bestEdge = edgesToDiff.sort((a, b) => confidenceRank(a.confidence) - confidenceRank(b.confidence))[0]!;
    const promptNode = nodeMap.get(bestEdge.from);
    if (!promptNode || promptNode.type !== 'prompt') continue;

    mappings.push({
      index: idx++,
      promptLabel: promptLabels.get(promptNode.id) ?? promptNode.label,
      diffLabel: diffNode.label,
      confidence: bestEdge.confidence,
    });
  }

  return mappings;
}

function confidenceRank(c: string): number {
  if (c === 'high') return 0;
  if (c === 'medium') return 1;
  return 2;
}

function truncate(s: string, max: number): string {
  const str = String(s ?? '');
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

interface TimelineEntry {
  time: string;
  type: string;
  label: string;
}

function buildTimeline(graph: ExecutionGraph, events: AIFREvent[], limit: number): TimelineEntry[] {
  const sorted = [...graph.nodes].sort((a, b) => a.timestamp - b.timestamp);
  const baseTs = sorted[0]?.timestamp ?? 0;
  const entries = sorted.slice(0, limit);

  return entries.map(n => {
    const offset = ((n.timestamp - baseTs) / 1000).toFixed(1);
    const typeIcon = nodeTypeIcon(n.type);
    return {
      time: `+${offset}s`,
      type: `${typeIcon} ${n.type}`,
      label: truncate(n.label, 80).replace(/\|/g, '\\|'),
    };
  });
}

function nodeTypeIcon(type: string): string {
  switch (type) {
    case 'prompt': return '💬';
    case 'command': return '⚡';
    case 'diff': return '📝';
    case 'test': return '🧪';
    case 'tool': return '🔧';
    case 'terminal': return '📺';
    case 'retry': return '🔄';
    case 'session': return '📌';
    default: return '❓';
  }
}
