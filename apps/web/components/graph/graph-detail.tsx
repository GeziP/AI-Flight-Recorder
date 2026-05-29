'use client';

import type { Node as RFNode } from '@xyflow/react';
import type { RawNode, RawEdge } from './use-graph-layout';

interface CommonNodeData {
  label: string;
  nodeType: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  eventIds?: string[];
  [key: string]: unknown;
}

interface GraphDetailProps {
  node: RFNode<CommonNodeData> | null;
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
  events: Array<Record<string, unknown>>;
  onClose: () => void;
}

export function GraphDetail({ node, rawNodes, rawEdges, events, onClose }: GraphDetailProps) {
  if (!node) return null;

  const data = node.data;
  const nodeId = node.id;
  const nodeType = data.nodeType;

  // Find downstream nodes connected by edges
  const downstreamEdges = rawEdges.filter(e => e.from === nodeId);
  const upstreamEdges = rawEdges.filter(e => e.to === nodeId);
  const downstreamNodes = downstreamEdges.map(e => rawNodes.find(n => n.id === e.to)).filter(Boolean) as RawNode[];
  const upstreamNodes = upstreamEdges.map(e => rawNodes.find(n => n.id === e.from)).filter(Boolean) as RawNode[];

  // Find original event content
  const eventIds = data.eventIds ?? [];
  const firstEvent = eventIds.length > 0 ? events.find(e => e.id === eventIds[0]) : null;

  return (
    <div className="h-[30vh] min-h-[160px] border-t border-border bg-white overflow-auto">
      <div className="max-w-3xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onClose} className="text-text-muted hover:text-text text-sm">✕</button>
          <span className="text-xs font-medium px-2 py-0.5 rounded capitalize bg-bg-subtle">{nodeType}</span>
          <span className="text-xs text-text-muted">{data.timestamp}</span>
          <span className="text-xs text-text-muted font-mono">{nodeId}</span>
        </div>

        {/* Content by type */}
        {nodeType === 'prompt' && (
          <div>
            <div className="text-[10px] font-medium text-text-muted uppercase mb-1">Content</div>
            <pre className="text-sm font-mono text-text bg-bg-subtle rounded p-3 whitespace-pre-wrap break-words max-h-[120px] overflow-auto">
              {firstEvent?.content as string ?? data.label}
            </pre>
          </div>
        )}

        {nodeType === 'diff' && (
          <div>
            <div className="text-[10px] font-medium text-text-muted uppercase mb-1">Changes</div>
            <div className="text-sm text-text">{data.label}</div>
            {firstEvent?.files && (
              <div className="mt-2 space-y-0.5">
                {(firstEvent.files as Array<Record<string, unknown>>).map((f, i) => (
                  <div key={i} className="text-xs font-mono text-text-secondary">
                    {String(f.status === 'added' ? '+' : f.status === 'deleted' ? '-' : 'M')} {String(f.path)}
                    {typeof f.additions === 'number' && <span className="text-green-600 ml-2">+{f.additions}</span>}
                    {typeof f.deletions === 'number' && <span className="text-red-500 ml-1">-{f.deletions}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {nodeType === 'command' && (
          <div>
            <div className="text-[10px] font-medium text-text-muted uppercase mb-1">Command</div>
            <code className="text-sm font-mono text-text bg-bg-subtle rounded px-2 py-1">{data.label}</code>
            {firstEvent?.stdout && (
              <pre className="mt-2 text-xs font-mono text-text-secondary bg-bg-subtle rounded p-2 max-h-[80px] overflow-auto whitespace-pre-wrap">
                {String(firstEvent.stdout).substring(0, 500)}
              </pre>
            )}
          </div>
        )}

        {nodeType === 'test' && (
          <div>
            <div className="text-[10px] font-medium text-text-muted uppercase mb-1">Test Result</div>
            <div className="flex items-center gap-2 text-sm">
              <span className={data.metadata?.outcome === 'pass' ? 'text-green-600' : 'text-red-500'}>
                {data.metadata?.outcome === 'pass' ? '✓ PASS' : '✗ FAIL'}
              </span>
              <span className="text-text">{data.label}</span>
            </div>
            {firstEvent?.output && (
              <pre className="mt-2 text-xs font-mono text-text-secondary bg-bg-subtle rounded p-2 max-h-[80px] overflow-auto whitespace-pre-wrap">
                {String(firstEvent.output).substring(0, 500)}
              </pre>
            )}
          </div>
        )}

        {!['prompt', 'diff', 'command', 'test'].includes(nodeType) && (
          <div>
            <div className="text-[10px] font-medium text-text-muted uppercase mb-1">Label</div>
            <div className="text-sm text-text">{data.label}</div>
          </div>
        )}

        {/* Downstream impacts */}
        {downstreamNodes.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] font-medium text-text-muted uppercase mb-1">Downstream</div>
            <div className="flex flex-wrap gap-1.5">
              {downstreamNodes.map(n => (
                <span key={n.id} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-subtle text-text-secondary font-mono">
                  {n.type}: {n.label.substring(0, 30)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Upstream causes */}
        {upstreamNodes.length > 0 && (
          <div className="mt-2">
            <div className="text-[10px] font-medium text-text-muted uppercase mb-1">Upstream</div>
            <div className="flex flex-wrap gap-1.5">
              {upstreamNodes.map(n => (
                <span key={n.id} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-subtle text-text-secondary font-mono">
                  {n.type}: {n.label.substring(0, 30)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
