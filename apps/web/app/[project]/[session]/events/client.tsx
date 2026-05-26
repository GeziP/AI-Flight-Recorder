'use client';

import { useState } from 'react';
import type { AIFREvent } from '@aifr/event-schema';
import { EventList } from '@/components/events/event-list';
import { EventDetail } from '@/components/events/event-detail';

export default function EventsClient({ events }: { events: AIFREvent[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedEvent = selectedId ? events.find((e) => e.id === selectedId) ?? null : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <EventList events={events} selectedId={selectedId} onSelect={setSelectedId} />
      <EventDetail event={selectedEvent} />
    </div>
  );
}
