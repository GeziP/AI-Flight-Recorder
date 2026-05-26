'use client';

import type { AIFREvent } from '@aifr/event-schema';

interface EventDetailProps {
  event: AIFREvent | null;
}

export function EventDetail({ event }: EventDetailProps) {
  if (!event) return null;

  return (
    <div className="h-40 border-t border-border flex flex-col overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border bg-bg-subtle shrink-0">
        <span className="text-[11px] text-text-muted uppercase" style={{ letterSpacing: '0.04em' }}>
          Event Detail &middot; {event.id}
        </span>
      </div>
      <pre className="flex-1 overflow-auto p-3 text-[11px] font-mono text-text-secondary leading-relaxed">
        {JSON.stringify(event, null, 2)}
      </pre>
    </div>
  );
}
