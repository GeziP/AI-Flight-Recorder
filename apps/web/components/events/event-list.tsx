'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type {
  AIFREvent,
  SessionEvent,
  PromptEvent,
  CommandEvent,
  DiffEvent,
  ToolEvent,
  TestEvent,
  TerminalOutputEvent,
  RetryEvent,
} from '@aifr/event-schema';

// ---- Event type config ----

const TYPE_CONFIG: Record<string, { dotClass: string; labelClass: string }> = {
  session:         { dotClass: 'bg-text',       labelClass: 'text-text' },
  prompt:          { dotClass: 'bg-prompt',     labelClass: 'text-prompt' },
  command:         { dotClass: 'bg-text',       labelClass: 'text-text' },
  diff:            { dotClass: 'bg-diff',       labelClass: 'text-diff' },
  tool:            { dotClass: 'bg-tool',       labelClass: 'text-tool' },
  test:            { dotClass: 'bg-test-pass',  labelClass: 'text-test-pass' },
  terminal_output: { dotClass: 'bg-text',       labelClass: 'text-text' },
  retry:           { dotClass: 'bg-retry',      labelClass: 'text-retry' },
};

const FILTER_TYPES = ['all', 'prompt', 'command', 'diff', 'tool', 'test'] as const;
type FilterType = (typeof FILTER_TYPES)[number];
const PAGE_SIZE = 150;

// ---- Timestamp formatting ----

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ---- Summary generators ----

function getSummary(event: AIFREvent): string {
  switch (event.type) {
    case 'session': {
      const e = event as SessionEvent;
      if (e.subtype === 'start') {
        return `start · ${e.gitBranch} · ${e.gitRef}`;
      }
      return `end · ${e.status}`;
    }
    case 'prompt': {
      const e = event as PromptEvent;
      const content = e.content.replace(/\n/g, ' ');
      return content.length > 60 ? content.slice(0, 60) + '…' : content;
    }
    case 'command': {
      const e = event as CommandEvent;
      const parts = [`$ ${e.command}`];
      if (e.exitCode !== undefined) parts.push(`exit ${e.exitCode}`);
      if (e.durationMs !== undefined) parts.push(`${(e.durationMs / 1000).toFixed(1)}s`);
      return parts.join(' · ');
    }
    case 'diff': {
      const e = event as DiffEvent;
      const filenames = e.files.map((f) => f.path.split('/').pop() ?? f.path).join(', ');
      return `${filenames} +${e.totalAdditions} -${e.totalDeletions}`;
    }
    case 'tool': {
      const e = event as ToolEvent;
      const filePath = (e.input?.file_path ?? e.input?.filePath) as string | undefined;
      const parts = [e.name];
      if (filePath) parts.push(`→ ${filePath}`);
      parts.push(e.status);
      if (e.durationMs !== undefined) parts.push(`${e.durationMs}ms`);
      return parts.join(' · ');
    }
    case 'test': {
      const e = event as TestEvent;
      const parts: string[] = [];
      if (e.framework) parts.push(e.framework);
      parts.push(`${e.passed ?? 0}/${e.totalTests ?? 0} pass`);
      if (e.failed) parts.push(`${e.failed} fail`);
      if (e.durationMs !== undefined) parts.push(`${(e.durationMs / 1000).toFixed(1)}s`);
      return parts.join(' · ');
    }
    case 'terminal_output': {
      const e = event as TerminalOutputEvent;
      const content = e.content.replace(/\n/g, ' ');
      return content.length > 60 ? content.slice(0, 60) + '…' : content;
    }
    case 'retry': {
      const e = event as RetryEvent;
      return `attempt ${e.attemptNumber} · "${e.reason}"`;
    }
    default:
      return '';
  }
}

// ---- Props ----

interface EventListProps {
  events: AIFREvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// ---- Component ----

export function EventList({ events, selectedId, onSelect }: EventListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let result = events;

    // Filter by type
    if (filter !== 'all') {
      result = result.filter((e) => e.type === filter);
    }

    // Filter by search text
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) => {
        if (e.id.toLowerCase().includes(q)) return true;
        if (e.type.toLowerCase().includes(q)) return true;
        if (getSummary(e).toLowerCase().includes(q)) return true;
        return false;
      });
    }

    return result;
  }, [events, filter, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filter, search]);

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setVisibleCount((c) => c + PAGE_SIZE); },
      { rootMargin: '200px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <input
          type="text"
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-bg-subtle border border-border rounded px-2.5 py-1 text-[12px] text-text placeholder:text-text-muted outline-none focus:border-text-muted"
        />
        <div className="flex items-center gap-0.5">
          {FILTER_TYPES.map((ft) => (
            <button
              key={ft}
              onClick={() => setFilter(ft)}
              className={`px-2 py-1 text-[11px] rounded transition-colors ${
                filter === ft
                  ? 'bg-bg-subtle font-medium text-text'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {ft.charAt(0).toUpperCase() + ft.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Event rows */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-8 text-center text-[12px] text-text-muted">
            No events found
          </div>
        ) : (
          <>
            {visible.map((event) => {
              const config = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.session;
              const isSelected = event.id === selectedId;

              return (
                <button
                  key={event.id}
                  onClick={() => onSelect(event.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left border-b border-border/50 transition-colors ${
                    isSelected ? 'bg-bg-subtle' : 'hover:bg-bg-subtle/50'
                  }`}
                >
                  {/* Timestamp */}
                  <span className="text-[11px] text-text-muted tabular-nums font-mono w-[72px] shrink-0">
                    {formatTimestamp(event.timestamp)}
                  </span>

                  {/* Colored dot */}
                  <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${config.dotClass}`} />

                  {/* Type label */}
                  <span className={`text-[11px] font-semibold w-[70px] shrink-0 ${config.labelClass}`}>
                    {event.type.toUpperCase()}
                  </span>

                  {/* Summary */}
                  <span className="text-[12px] text-text-secondary truncate flex-1 min-w-0">
                    {getSummary(event)}
                  </span>

                  {/* Event ID */}
                  <span className="text-[10px] font-mono text-text-muted shrink-0">
                    {event.id.slice(0, 8)}
                  </span>
                </button>
              );
            })}
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-3 text-text-muted text-[11px]">
                {visible.length} / {filtered.length}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
