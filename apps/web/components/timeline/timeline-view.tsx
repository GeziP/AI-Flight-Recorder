'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { AIFREvent, EventType } from '@aifr/event-schema';
import { TimelineEventRow } from './timeline-event';
import { TimelineFilter } from './timeline-filter';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${secs}s`;
}

const PAGE_SIZE = 100;

interface TimelineViewProps {
  events: AIFREvent[];
  sessionName: string;
  metadata?: {
    agentType: string;
    gitBranch: string;
    eventCount: number;
    durationMs?: number;
  };
}

export function TimelineView({ events, sessionName, metadata }: TimelineViewProps) {
  const [activeFilter, setActiveFilter] = useState<EventType | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return events;
    return events.filter((e) => e.type === activeFilter);
  }, [events, activeFilter]);

  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEvents.length;

  // Reset page when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeFilter]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => c + PAGE_SIZE);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[14px] font-medium text-text">{sessionName}</h2>
            {metadata && (
              <div className="flex items-center gap-2 text-[12px] text-text-muted">
                <span className="font-mono">{metadata.agentType}</span>
                <span>&middot;</span>
                <span className="font-mono">{metadata.gitBranch}</span>
                <span>&middot;</span>
                <span>{metadata.eventCount} events</span>
                {metadata.durationMs !== undefined && (
                  <>
                    <span>&middot;</span>
                    <span>{formatDuration(metadata.durationMs)}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <TimelineFilter activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        </div>
      </div>

      {/* Scrollable timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-muted text-[13px]">
            No events match the selected filter
          </div>
        ) : (
          <div>
            {visibleEvents.map((event, index) => (
              <TimelineEventRow
                key={event.id}
                event={event}
                isLast={index === visibleEvents.length - 1 && !hasMore}
              />
            ))}
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-4 text-text-muted text-[12px]">
                Loading {Math.min(visibleCount, filteredEvents.length)} / {filteredEvents.length}...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
