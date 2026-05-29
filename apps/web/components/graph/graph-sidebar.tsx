'use client';

import { NODE_COLORS } from './graph-nodes';

const FILTERABLE_TYPES = ['prompt', 'command', 'diff', 'test', 'tool', 'terminal', 'session'];

interface GraphSidebarProps {
  collapsed: Set<string>;
  onToggle: (type: string) => void;
  stats: {
    totalNodes: number;
    totalEdges: number;
    visibleNodes: number;
    byType: Record<string, number>;
    attributionRate: string;
    retryCount: number;
  };
}

export function GraphSidebar({ collapsed, onToggle, stats }: GraphSidebarProps) {
  return (
    <div className="w-48 shrink-0 border-r border-border bg-bg-subtle p-3 space-y-4 overflow-auto text-xs">
      {/* Node Filters */}
      <div>
        <div className="font-medium text-text mb-2">Filter Nodes</div>
        <div className="space-y-1.5">
          {FILTERABLE_TYPES.map(type => {
            const count = stats.byType[type] ?? 0;
            if (count === 0) return null;
            const isHidden = collapsed.has(type);
            const color = NODE_COLORS[type] ?? '#6b7280';
            return (
              <label key={type} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => onToggle(type)}
                  className="rounded border-gray-300 text-blue-500 focus:ring-blue-400 focus:ring-offset-0 w-3.5 h-3.5"
                />
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className={`capitalize ${isHidden ? 'text-text-muted line-through' : 'text-text'}`}>
                  {type}
                </span>
                <span className="text-text-muted ml-auto">{count}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div>
        <div className="font-medium text-text mb-2">Stats</div>
        <div className="space-y-1 text-text-secondary">
          <div className="flex justify-between">
            <span>Nodes</span>
            <span>{stats.visibleNodes}/{stats.totalNodes}</span>
          </div>
          <div className="flex justify-between">
            <span>Edges</span>
            <span>{stats.totalEdges}</span>
          </div>
          <div className="flex justify-between">
            <span>Attributed</span>
            <span>{stats.attributionRate}</span>
          </div>
          {stats.retryCount > 0 && (
            <div className="flex justify-between text-yellow-600">
              <span>Retries</span>
              <span>{stats.retryCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div>
        <div className="font-medium text-text mb-2">Edge Types</div>
        <div className="space-y-1 text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="w-6 border-t-2 border-blue-500" />
            <span>caused by</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 border-t border-gray-400" />
            <span>produced patch</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 border-t border-purple-400" />
            <span>verified by</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 border-t-2 border-red-400 border-dashed" />
            <span>failed → retry</span>
          </div>
        </div>
      </div>
    </div>
  );
}
