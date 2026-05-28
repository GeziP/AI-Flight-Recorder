import type { GraphNode, GraphEdge, GraphWarning, Confidence, EdgeSource } from './types.js';
import {
  COMMAND_AFTER_PROMPT_MS,
  DIFF_AFTER_COMMAND_MS,
  TEST_AFTER_DIFF_MS,
  FALLBACK_PROMPT_DIFF_MS,
  HIGH_CONFIDENCE_THRESHOLD_MS,
  FILE_OP_KEYWORDS,
} from './constants.js';

export function inferEdges(nodes: GraphNode[], existingEdges?: GraphEdge[]): {
  edges: GraphEdge[];
  warnings: GraphWarning[];
} {
  const warnings: GraphWarning[] = [];
  const edges: GraphEdge[] = [];
  let edgeCounter = 0;

  const manualEdges = (existingEdges ?? []).filter(e => e.source === 'manual');
  for (const me of manualEdges) edges.push(me);

  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Phase A: basic edges
  const phaseAEdges: GraphEdge[] = [];

  // Rule 1: prompt -> command (caused_by)
  for (const cmd of nodes) {
    if (cmd.type !== 'command') continue;
    const nearestPrompt = findNearestBefore(nodes, cmd, 'prompt', COMMAND_AFTER_PROMPT_MS);
    if (nearestPrompt) {
      const gap = cmd.timestamp - nearestPrompt.timestamp;
      const confidence: Confidence = gap < HIGH_CONFIDENCE_THRESHOLD_MS ? 'high' : 'medium';
      phaseAEdges.push(makeEdge(edgeCounter++, nearestPrompt.id, cmd.id, 'caused_by', confidence, `Command '${(cmd.metadata.command as string) ?? 'unknown'}' started ${gap}ms after prompt`));
    }
  }

  // Rule 2: command -> diff (produced_patch)
  for (const diff of nodes) {
    if (diff.type !== 'diff') continue;
    if (diff.metadata.isBaseline === true) continue;
    const nearestCmd = findNearestBefore(nodes, diff, 'command', DIFF_AFTER_COMMAND_MS);
    if (nearestCmd && isFileOpCommand(nearestCmd.metadata.command as string)) {
      const gap = diff.timestamp - nearestCmd.timestamp;
      phaseAEdges.push(makeEdge(edgeCounter++, nearestCmd.id, diff.id, 'produced_patch', 'high', `Diff detected ${gap}ms after command '${(nearestCmd.metadata.command as string) ?? 'unknown'}'`));
    }
  }

  // Rule 5: diff -> test (verified_by)
  for (const test of nodes) {
    if (test.type !== 'test') continue;
    const nearestDiff = findNearestBefore(nodes, test, 'diff', TEST_AFTER_DIFF_MS, n => n.metadata.isBaseline !== true);
    if (nearestDiff) {
      const gap = test.timestamp - nearestDiff.timestamp;
      phaseAEdges.push(makeEdge(edgeCounter++, nearestDiff.id, test.id, 'verified_by', 'high', `Test ran ${gap}ms after diff`));
    }
  }

  // Rule 6: test(fail) -> next prompt/diff (failed_then_retry)
  for (const test of nodes) {
    if (test.type !== 'test') continue;
    if (test.metadata.outcome !== 'fail' && test.metadata.outcome !== 'error') continue;
    const next = findFirstAfter(nodes, test, ['prompt', 'diff']);
    if (next) {
      const gap = next.timestamp - test.timestamp;
      phaseAEdges.push(makeEdge(edgeCounter++, test.id, next.id, 'failed_then_retry', 'high', `Retry after test failure`));
    }
  }

  edges.push(...phaseAEdges);

  // Phase B: chain attribution — prompt -> diff via command bridge
  const producedPatch = phaseAEdges.filter(e => e.type === 'produced_patch');
  const causedByCmd = phaseAEdges.filter(e => e.type === 'caused_by' && nodeMap.get(e.from)?.type === 'prompt' && nodeMap.get(e.to)?.type === 'command');

  const diffsWithChain = new Set<string>();
  for (const ppEdge of producedPatch) {
    const cmdNode = nodeMap.get(ppEdge.from);
    if (!cmdNode) continue;
    const cmdToPrompt = causedByCmd.find(e => e.to === cmdNode.id);
    if (!cmdToPrompt) continue;

    const promptNode = nodeMap.get(cmdToPrompt.from);
    const diffNode = nodeMap.get(ppEdge.to);
    if (!promptNode || !diffNode) continue;

    if (!hasPromptBetween(nodes, promptNode, diffNode)) {
      const gap = diffNode.timestamp - promptNode.timestamp;
      edges.push(makeEdge(edgeCounter++, promptNode.id, diffNode.id, 'caused_by', 'high', `Chain: prompt -> command '${(cmdNode.metadata.command as string) ?? ''}' -> diff (${gap}ms)`));
      diffsWithChain.add(diffNode.id);
    }
  }

  // Phase C: fallback — prompt -> diff time window
  for (const diff of nodes) {
    if (diff.type !== 'diff') continue;
    if (diff.metadata.isBaseline === true) continue;
    if (diffsWithChain.has(diff.id)) continue;

    const nearestPrompt = findNearestBefore(nodes, diff, 'prompt', FALLBACK_PROMPT_DIFF_MS);
    if (nearestPrompt) {
      if (!isCloserPrompt(nodes, nearestPrompt, diff)) {
        const gap = diff.timestamp - nearestPrompt.timestamp;
        edges.push(makeEdge(edgeCounter++, nearestPrompt.id, diff.id, 'caused_by', 'low', `Diff within ${gap}ms of prompt, no command bridge`));
      }
    }
  }

  if (nodes.length > 0 && edges.length === manualEdges.length) {
    warnings.push({ code: 'no_edges', message: 'No edges inferred from events' });
  }

  return { edges, warnings };
}

function makeEdge(id: number, from: string, to: string, type: GraphEdge['type'], confidence: Confidence, evidence: string, source: EdgeSource = 'inferred'): GraphEdge {
  return { id: `edge_${id}`, from, to, type, confidence, evidence: [evidence], source };
}

function findNearestBefore(nodes: GraphNode[], target: GraphNode, type: GraphNode['type'], windowMs: number, filter?: (n: GraphNode) => boolean): GraphNode | null {
  let best: GraphNode | null = null;
  let bestGap = Infinity;
  for (const n of nodes) {
    if (n.type !== type) continue;
    if (n.timestamp >= target.timestamp) continue;
    const gap = target.timestamp - n.timestamp;
    if (gap > windowMs) continue;
    if (filter && !filter(n)) continue;
    if (gap < bestGap) {
      best = n;
      bestGap = gap;
    }
  }
  return best;
}

function findFirstAfter(nodes: GraphNode[], target: GraphNode, types: string[]): GraphNode | null {
  let best: GraphNode | null = null;
  for (const n of nodes) {
    if (n.timestamp <= target.timestamp) continue;
    if (!types.includes(n.type)) continue;
    if (!best || n.timestamp < best.timestamp) best = n;
  }
  return best;
}

function hasPromptBetween(nodes: GraphNode[], from: GraphNode, to: GraphNode): boolean {
  for (const n of nodes) {
    if (n.type !== 'prompt') continue;
    if (n.timestamp <= from.timestamp || n.timestamp >= to.timestamp) continue;
    if (n.id === from.id) continue;
    return true;
  }
  return false;
}

function isCloserPrompt(nodes: GraphNode[], candidate: GraphNode, diff: GraphNode): boolean {
  for (const n of nodes) {
    if (n.type !== 'prompt') continue;
    if (n.id === candidate.id) continue;
    if (n.timestamp >= diff.timestamp) continue;
    const gap = diff.timestamp - n.timestamp;
    if (gap > FALLBACK_PROMPT_DIFF_MS) continue;
    const candidateGap = diff.timestamp - candidate.timestamp;
    if (gap < candidateGap) return true;
  }
  return false;
}

function isFileOpCommand(command: string): boolean {
  if (!command) return false;
  const lower = command.toLowerCase();
  return FILE_OP_KEYWORDS.some(kw => lower.includes(kw));
}
