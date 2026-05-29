'use client';

import { useMemo } from 'react';
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

const NODE_WIDTHS: Record<string, number> = {
  prompt: 240,
  command: 180,
  diff: 180,
  test: 120,
  tool: 130,
  terminal: 100,
  retry: 120,
  session: 100,
};

const NODE_HEIGHTS: Record<string, number> = {
  prompt: 72,
  command: 48,
  diff: 48,
  test: 44,
  tool: 40,
  terminal: 32,
  retry: 40,
  session: 36,
};

export interface RawNode {
  id: string;
  type: string;
  label: string;
  timestamp: number;
  metadata: Record<string, unknown>;
  eventIds: string[];
}

export interface RawEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  confidence: string;
  source: string;
  evidence: string[];
}

export function useGraphLayout(rawNodes: RawNode[], rawEdges: RawEdge[], collapsed: Set<string>) {
  return useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 60, marginx: 40, marginy: 40 });

    // Filter collapsed node types
    const visibleNodes = rawNodes.filter(n => !collapsed.has(n.type));
    const visibleIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = rawEdges.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to));

    // Collapsed groups: count hidden nodes by type per "parent" area
    const collapsedGroups = new Map<string, { type: string; count: number; parentNodeId: string }>();
    for (const node of rawNodes) {
      if (collapsed.has(node.type) && !collapsedGroups.has(node.type)) {
        collapsedGroups.set(node.type, {
          type: node.type,
          count: rawNodes.filter(n => n.type === node.type).length,
          parentNodeId: `collapsed-${node.type}`,
        });
      }
    }

    // Add visible nodes to dagre
    for (const node of visibleNodes) {
      const w = NODE_WIDTHS[node.type] ?? 130;
      const h = NODE_HEIGHTS[node.type] ?? 40;
      g.setNode(node.id, { width: w, height: h });
    }

    // Add collapsed group nodes
    for (const [, group] of collapsedGroups) {
      if (group.count > 0) {
        const w = 120;
        const h = 40;
        g.setNode(group.parentNodeId, { width: w, height: h });
      }
    }

    // Add edges to dagre
    for (const edge of visibleEdges) {
      g.setEdge(edge.from, edge.to);
    }

    // Connect collapsed groups to their nearest visible neighbors
    for (const node of rawNodes) {
      if (!collapsed.has(node.type)) continue;
      const group = collapsedGroups.get(node.type);
      if (!group) continue;
      // Find edges from this hidden node to visible nodes
      for (const edge of rawEdges) {
        if (edge.from === node.id && visibleIds.has(edge.to)) {
          try { g.setEdge(group.parentNodeId, edge.to); } catch { /* skip duplicates */ }
        }
        if (edge.to === node.id && visibleIds.has(edge.from)) {
          try { g.setEdge(edge.from, group.parentNodeId); } catch { /* skip duplicates */ }
        }
      }
    }

    dagre.layout(g);

    const baseTs = visibleNodes.length > 0 ? Math.min(...visibleNodes.map(n => n.timestamp)) : 0;

    const nodes: Node[] = visibleNodes.map(node => {
      const pos = g.node(node.id);
      const w = NODE_WIDTHS[node.type] ?? 130;
      const h = NODE_HEIGHTS[node.type] ?? 40;
      return {
        id: node.id,
        type: node.type === 'prompt' ? 'prompt' : node.type === 'diff' ? 'diff' : node.type === 'test' ? 'test' : 'custom',
        position: pos ? { x: pos.x - w / 2, y: pos.y - h / 2 } : { x: 0, y: 0 },
        data: {
          label: node.label,
          nodeType: node.type,
          timestamp: formatTime(node.timestamp, baseTs),
          rawTimestamp: node.timestamp,
          metadata: node.metadata,
          eventIds: node.eventIds,
        },
      };
    });

    // Add collapsed group nodes
    for (const [, group] of collapsedGroups) {
      if (group.count === 0) continue;
      const pos = g.node(group.parentNodeId);
      nodes.push({
        id: group.parentNodeId,
        type: 'collapsed',
        position: pos ? { x: pos.x - 60, y: pos.y - 20 } : { x: 0, y: 0 },
        data: {
          label: `${group.count} ${group.type}${group.count > 1 ? 's' : ''}`,
          nodeType: group.type,
          count: group.count,
        },
      });
    }

    // Build edges for React Flow
    const edges: Edge[] = visibleEdges.map(edge => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: 'smoothstep',
      animated: edge.type === 'failed_then_retry',
      data: { edgeType: edge.type, confidence: edge.confidence, source: edge.source },
    }));

    return { nodes, edges, stats: buildStats(rawNodes, rawEdges, collapsed) };
  }, [rawNodes, rawEdges, collapsed]);
}

function formatTime(ts: number, baseTs: number): string {
  const diff = ((ts - baseTs) / 1000);
  if (diff < 60) return `+${diff.toFixed(1)}s`;
  const min = Math.floor(diff / 60);
  const sec = Math.round(diff % 60);
  return `+${min}m ${sec}s`;
}

function buildStats(nodes: RawNode[], edges: RawEdge[], collapsed: Set<string>) {
  const byType: Record<string, number> = {};
  for (const n of nodes) byType[n.type] = (byType[n.type] ?? 0) + 1;

  const causedByEdges = edges.filter(e => e.type === 'caused_by');
  const diffIds = new Set(nodes.filter(n => n.type === 'diff').map(n => n.id));
  const attributedDiffs = new Set(causedByEdges.filter(e => diffIds.has(e.to)).map(e => e.to));

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    visibleNodes: nodes.filter(n => !collapsed.has(n.type)).length,
    byType,
    attributionRate: diffIds.size > 0 ? `${attributedDiffs.size}/${diffIds.size}` : '0/0',
    retryCount: edges.filter(e => e.type === 'failed_then_retry').length,
  };
}
