'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes, NODE_COLORS } from './graph-nodes';
import { edgeTypes } from './graph-edges';
import { useGraphLayout, type RawNode, type RawEdge } from './use-graph-layout';
import { GraphSidebar } from './graph-sidebar';
import { GraphDetail } from './graph-detail';

interface GraphCanvasProps {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
}

const DEFAULT_COLLAPSED = new Set(['tool', 'terminal', 'session']);

export function GraphCanvas({ nodes: rawGraphNodes, edges: rawGraphEdges, events }: GraphCanvasProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(DEFAULT_COLLAPSED);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const rawNodes: RawNode[] = useMemo(() =>
    rawGraphNodes.map(n => ({
      id: String(n.id),
      type: String(n.type ?? 'tool'),
      label: String(n.label ?? ''),
      timestamp: Number(n.timestamp ?? 0),
      metadata: (n.metadata as Record<string, unknown>) ?? {},
      eventIds: ((n.eventIds as string[]) ?? []),
    })),
    [rawGraphNodes]
  );

  const rawEdges: RawEdge[] = useMemo(() =>
    rawGraphEdges.map(e => ({
      id: String(e.id),
      from: String(e.from),
      to: String(e.to),
      type: String(e.type ?? 'caused_by'),
      confidence: String(e.confidence ?? 'medium'),
      source: String(e.source ?? 'inferred'),
      evidence: ((e.evidence as string[]) ?? []),
    })),
    [rawGraphEdges]
  );

  const { nodes: layoutNodes, edges: layoutEdges, stats } = useGraphLayout(rawNodes, rawEdges, collapsed);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(layoutNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(layoutEdges);

  const selectedNode = selectedNodeId ? rfNodes.find(n => n.id === selectedNodeId) ?? null : null;

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(prev => prev === node.id ? null : node.id);
  }, []);

  const toggleCollapsed = useCallback((type: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const nodeColor = useCallback((node: Node) => {
    const nodeType = (node.data as Record<string, unknown>)?.nodeType as string;
    return NODE_COLORS[nodeType] ?? '#6b7280';
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <GraphSidebar collapsed={collapsed} onToggle={toggleCollapsed} stats={stats} />

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, minZoom: 0.3 }}
            minZoom={0.05}
            maxZoom={2}
            defaultEdgeOptions={{ type: 'causedBy' }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
          >
            <Background gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={nodeColor}
              zoomable
              pannable
              maskColor="rgba(0,0,0,0.05)"
              className="!bg-white !border-border"
            />
          </ReactFlow>

          {/* Attribution badge */}
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-xs text-text-secondary shadow-sm">
            Attribution: <span className="font-medium text-text">{stats.attributionRate} diffs</span>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <GraphDetail
        node={selectedNode}
        rawNodes={rawNodes}
        rawEdges={rawEdges}
        events={events}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
}
