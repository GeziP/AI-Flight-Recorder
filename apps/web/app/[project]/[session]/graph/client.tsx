'use client';

import { GraphCanvas } from '@/components/graph/graph-canvas';

interface GraphViewClientProps {
  graph: Record<string, unknown> | undefined;
  events: Array<Record<string, unknown>>;
}

export function GraphViewClient({ graph, events }: GraphViewClientProps) {
  if (!graph) {
    return (
      <div className="flex-1 p-8 text-text-muted">
        No graph data available. Run <code className="bg-bg-subtle px-1.5 py-0.5 rounded text-xs">aifr graph</code> to generate.
      </div>
    );
  }

  const nodes = (graph.nodes as Array<Record<string, unknown>>) ?? [];
  const edges = (graph.edges as Array<Record<string, unknown>>) ?? [];

  if (nodes.length === 0) {
    return <div className="flex-1 p-8 text-text-muted">No nodes in graph.</div>;
  }

  return <GraphCanvas nodes={nodes} edges={edges} events={events} />;
}
