export type GraphNodeType =
  | 'prompt'
  | 'command'
  | 'diff'
  | 'test'
  | 'tool'
  | 'terminal'
  | 'retry'
  | 'session';

export type EdgeType = 'caused_by' | 'produced_patch' | 'verified_by' | 'failed_then_retry';

export type Confidence = 'high' | 'medium' | 'low';

export type EdgeSource = 'inferred' | 'manual';

export interface GraphWarning {
  code: string;
  message: string;
  eventId?: string;
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  eventIds: string[];
  label: string;
  timestamp: number;
  timestampEnd?: number;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  confidence: Confidence;
  evidence: string[];
  source: EdgeSource;
}

export interface ExecutionGraph {
  schemaVersion: string;
  sessionId: string;
  generatedAt: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: GraphWarning[];
}
