'use client';

import { BaseEdge, getSmoothStepPath, type EdgeProps, type EdgeTypes } from '@xyflow/react';

const EDGE_COLORS: Record<string, string> = {
  caused_by: '#3b82f6',
  produced_patch: '#10b981',
  verified_by: '#8b5cf6',
  failed_then_retry: '#ef4444',
};

const CONFIDENCE_WIDTH: Record<string, number> = { high: 2, medium: 1.5, low: 1 };
const CONFIDENCE_DASH: Record<string, string | undefined> = { high: undefined, medium: '6 3', low: '3 3' };

function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const edgeType = (data?.edgeType as string) ?? 'caused_by';
  const confidence = (data?.confidence as string) ?? 'medium';

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 8,
  });

  const isCausedBy = edgeType === 'caused_by';
  const color = isCausedBy ? (EDGE_COLORS[edgeType] ?? '#6b7280') : '#94a3b8';

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: color,
        strokeWidth: CONFIDENCE_WIDTH[confidence] ?? 1,
        strokeDasharray: CONFIDENCE_DASH[confidence],
      }}
    />
  );
}

export const edgeTypes: EdgeTypes = {
  smoothstep: CustomEdge,
};
