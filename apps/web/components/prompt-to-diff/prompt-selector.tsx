'use client';

import type { PromptEvent } from '@aifr/event-schema';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

interface PromptSelectorProps {
  prompts: PromptEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PromptSelector({ prompts, selectedId, onSelect }: PromptSelectorProps) {
  if (prompts.length === 0) {
    return (
      <div className="text-[13px] text-text-muted py-4 text-center">
        No user prompts found in this session
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {prompts.map((prompt, index) => {
        const isActive = prompt.id === selectedId;
        return (
          <button
            key={prompt.id}
            onClick={() => onSelect(prompt.id)}
            className={`shrink-0 text-left px-3 py-2 rounded-md border text-[12px] transition-colors ${
              isActive
                ? 'border-prompt bg-prompt/10 text-text'
                : 'border-border bg-bg-subtle text-text-secondary hover:border-prompt/40 hover:text-text'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[11px] text-text-muted">
                {formatTimestamp(prompt.timestamp)}
              </span>
              <span className="text-[10px] text-text-muted">#{index + 1}</span>
            </div>
            <div className="max-w-[180px] truncate">{truncate(prompt.content, 40)}</div>
          </button>
        );
      })}
    </div>
  );
}
