import type { AIFREvent } from '@aifr/event-schema';
import type { ExecutionGraph, GraphEdge } from './types.js';
import { GRAPH_SCHEMA_VERSION } from './constants.js';
import { extractNodes } from './node-extractor.js';
import { inferEdges } from './edge-inferencer.js';

export interface BuildGraphOptions {
  sessionId: string;
  existingEdges?: GraphEdge[];
}

export function buildGraph(events: AIFREvent[], options: BuildGraphOptions): ExecutionGraph {
  const { nodes, warnings: nodeWarnings } = extractNodes(events);
  const { edges, warnings: edgeWarnings } = inferEdges(nodes, options.existingEdges);

  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    sessionId: options.sessionId,
    generatedAt: Date.now(),
    nodes,
    edges,
    warnings: [...nodeWarnings, ...edgeWarnings],
  };
}
