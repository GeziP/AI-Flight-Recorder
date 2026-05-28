'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface GraphViewClientProps {
  graph: Record<string, unknown> | undefined;
}

const NODE_COLORS: Record<string, string> = {
  prompt: '#3b82f6',
  command: '#f59e0b',
  diff: '#10b981',
  test: '#8b5cf6',
  tool: '#6b7280',
  terminal: '#6b7280',
  retry: '#ef4444',
  session: '#64748b',
};

const EDGE_COLORS: Record<string, string> = {
  caused_by: '#3b82f6',
  produced_patch: '#10b981',
  verified_by: '#8b5cf6',
  failed_then_retry: '#ef4444',
};

const CONFIDENCE_STYLE: Record<string, string> = {
  high: '',
  medium: '5 5',
  low: '2 4',
};

function CustomNode({ data }: { data: { label: string; nodeType: string; timestamp: string } }) {
  const color = NODE_COLORS[data.nodeType] ?? '#6b7280';
  return (
    <div
      className="px-3 py-1.5 rounded-md text-xs font-mono max-w-[200px] border"
      style={{
        borderColor: color,
        backgroundColor: `${color}15`,
        boxShadow: `0 0 0 1px ${color}30`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="truncate" title={String(data.label)}>{String(data.label)}</span>
      </div>
      <div className="text-text-muted text-[10px] mt-0.5">{data.timestamp}</div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

function formatTime(ts: number, baseTs: number): string {
  const diff = ((ts - baseTs) / 1000).toFixed(1);
  return `+${diff}s`;
}

export function GraphViewClient({ graph }: GraphViewClientProps) {
  if (!graph) {
    return (
      <div className="flex-1 p-8 text-text-muted">
        No graph data available. Run <code className="bg-card px-1.5 py-0.5 rounded text-xs">aifr graph</code> to generate.
      </div>
    );
  }

  const nodes = (graph.nodes as Array<Record<string, unknown>>) ?? [];
  const edges = (graph.edges as Array<Record<string, unknown>>) ?? [];

  if (nodes.length === 0) {
    return <div className="flex-1 p-8 text-text-muted">No nodes in graph.</div>;
  }

  return <GraphCanvas nodes={nodes} edges={edges} />;
}

function GraphCanvas({ nodes, edges }: { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> }) {
  const baseTs = Math.min(...nodes.map(n => Number(n.timestamp)));

  const layoutNodes = useMemo(() => {
    // Simple top-down layout by timestamp
    const sorted = [...nodes].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    const COLS = 6;
    const X_SPACING = 240;
    const Y_SPACING = 80;

    return sorted.map((n, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      return {
        id: String(n.id),
        type: 'custom' as const,
        position: { x: col * X_SPACING, y: row * Y_SPACING },
        data: {
          label: String(n.label ?? ''),
          nodeType: String(n.type ?? 'tool'),
          timestamp: formatTime(Number(n.timestamp), baseTs),
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      } satisfies Node;
    });
  }, [nodes, baseTs]);

  const layoutEdges = useMemo(() => {
    return edges.map(e => {
      const edgeType = String(e.type ?? 'caused_by');
      const confidence = String(e.confidence ?? 'medium');
      return {
        id: String(e.id),
        source: String(e.from),
        target: String(e.to),
        label: edgeType.replace(/_/g, ' '),
        animated: edgeType === 'failed_then_retry',
        style: {
          stroke: EDGE_COLORS[edgeType] ?? '#6b7280',
          strokeDasharray: CONFIDENCE_STYLE[confidence] ?? '',
          strokeWidth: confidence === 'high' ? 2 : 1,
        },
        labelStyle: { fontSize: 10, fill: '#888' },
        markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
      } satisfies Edge;
    });
  }, [edges]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(layoutNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(layoutEdges);

  const nodeColor = useCallback((node: Node) => {
    const nodeType = (node.data as Record<string, unknown>)?.nodeType as string;
    return NODE_COLORS[nodeType] ?? '#6b7280';
  }, []);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap nodeColor={nodeColor} zoomable pannable />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card border border-border rounded-lg p-3 text-xs space-y-1">
        <div className="font-medium mb-1.5">Node Types</div>
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
