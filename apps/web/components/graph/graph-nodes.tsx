'use client';

import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react';
import type { Node as RFNode } from '@xyflow/react';

const NODE_COLORS: Record<string, string> = {
  prompt: '#6366f1',
  command: '#f59e0b',
  diff: '#10b981',
  test: '#8b5cf6',
  tool: '#6b7280',
  terminal: '#6b7280',
  retry: '#ef4444',
  session: '#64748b',
};

interface CommonNodeData {
  label: string;
  nodeType: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

function PromptNode({ data }: NodeProps<RFNode<CommonNodeData>>) {
  const color = NODE_COLORS.prompt;
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs font-mono border-l-[3px] max-w-[240px] bg-white border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      style={{ borderLeftColor: color }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-300" />
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}15`, color }}>PROMPT</span>
        <span className="text-text-muted text-[10px] ml-auto">{data.timestamp}</span>
      </div>
      <div className="text-text leading-snug break-words" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-300" />
    </div>
  );
}

function DiffNode({ data }: NodeProps<RFNode<CommonNodeData>>) {
  const color = NODE_COLORS.diff;
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs font-mono border-l-[3px] max-w-[180px] bg-white border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      style={{ borderLeftColor: color }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-300" />
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}15`, color }}>DIFF</span>
        <span className="text-text-muted text-[10px] ml-auto">{data.timestamp}</span>
      </div>
      <div className="text-text truncate">{data.label}</div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-300" />
    </div>
  );
}

function TestNode({ data }: NodeProps<RFNode<CommonNodeData>>) {
  const outcome = data.metadata?.outcome as string | undefined;
  const pass = outcome === 'pass';
  const bgColor = pass ? '#dcfce7' : '#fee2e2';
  const textColor = pass ? '#166534' : '#991b1b';
  const icon = pass ? '✓' : '✗';
  return (
    <div
      className="px-2.5 py-1.5 rounded-full text-xs font-mono flex items-center gap-1.5 border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      style={{ backgroundColor: bgColor, borderColor: pass ? '#bbf7d0' : '#fecaca', color: textColor }}
    >
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-gray-300" />
      <span className="font-bold">{icon}</span>
      <span className="truncate max-w-[80px]">{data.label}</span>
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-gray-300" />
    </div>
  );
}

function CustomNode({ data }: NodeProps<RFNode<CommonNodeData>>) {
  const nodeType = data.nodeType ?? 'tool';
  const color = NODE_COLORS[nodeType] ?? '#6b7280';
  return (
    <div
      className="px-2.5 py-1.5 rounded-md text-xs font-mono max-w-[140px] bg-white border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-gray-300" />
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[10px] text-text-muted capitalize">{nodeType}</span>
      </div>
      <div className="text-text truncate mt-0.5">{data.label}</div>
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-gray-300" />
    </div>
  );
}

function CollapsedNode({ data }: NodeProps<RFNode<{ label: string; nodeType: string; count: number; [key: string]: unknown }>>) {
  const color = NODE_COLORS[data.nodeType] ?? '#6b7280';
  return (
    <div
      className="px-3 py-1.5 rounded-md text-xs font-mono bg-gray-50 border border-dashed border-gray-300 flex items-center gap-2 cursor-pointer"
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-text-muted">{data.label}</span>
      <span className="bg-gray-200 text-text-secondary px-1.5 py-0.5 rounded text-[10px]">{data.count}</span>
    </div>
  );
}

export const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  diff: DiffNode,
  test: TestNode,
  custom: CustomNode,
  collapsed: CollapsedNode,
};

export { NODE_COLORS };
