'use client';

import type { EventType } from '@aifr/event-schema';

const FILTER_OPTIONS: Array<{ value: EventType | 'all'; label: string; dotClass?: string }> = [
  { value: 'all', label: 'All' },
  { value: 'prompt', label: 'Prompt', dotClass: 'bg-prompt' },
  { value: 'command', label: 'Command', dotClass: 'bg-text' },
  { value: 'diff', label: 'Diff', dotClass: 'bg-diff' },
  { value: 'tool', label: 'Tool', dotClass: 'bg-tool' },
  { value: 'test', label: 'Test', dotClass: 'bg-test-pass' },
  { value: 'retry', label: 'Retry', dotClass: 'bg-retry' },
];

interface TimelineFilterProps {
  activeFilter: EventType | 'all';
  onFilterChange: (filter: EventType | 'all') => void;
}

export function TimelineFilter({ activeFilter, onFilterChange }: TimelineFilterProps) {
  return (
    <div className="flex items-center gap-1">
      {FILTER_OPTIONS.map((opt) => {
        const isActive = activeFilter === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onFilterChange(opt.value)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] transition-colors ${
              isActive
                ? 'bg-bg-subtle font-medium text-text'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {opt.dotClass && (
              <span className={`w-[7px] h-[7px] rounded-full ${opt.dotClass}`} />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
