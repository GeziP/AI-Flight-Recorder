'use client';

import { useState, useMemo } from 'react';
import type { AIFREvent } from '@aifr/event-schema';
import { mapPromptToChanges, findAllPrompts } from '@/lib/prompt-mapping';
import { PromptSelector } from '@/components/prompt-to-diff/prompt-selector';
import { ExecutionPath } from '@/components/prompt-to-diff/execution-path';
import { RelatedChanges } from '@/components/prompt-to-diff/related-changes';

interface PromptToDiffClientProps {
  events: AIFREvent[];
}

export default function PromptToDiffClient({ events }: PromptToDiffClientProps) {
  const prompts = useMemo(() => findAllPrompts(events), [events]);
  const [selectedId, setSelectedId] = useState<string | null>(
    prompts.length > 0 ? prompts[0].id : null,
  );

  const mapping = useMemo(
    () => (selectedId ? mapPromptToChanges(events, selectedId) : null),
    [events, selectedId],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-3">
        <h2 className="text-[14px] font-medium text-text">Prompt-to-Diff Mapping</h2>
        <p className="text-[12px] text-text-muted mt-0.5">
          {prompts.length} prompt{prompts.length !== 1 ? 's' : ''} &middot; select a prompt to see
          related changes
        </p>
      </div>

      {/* Prompt selector */}
      <div className="shrink-0 border-b border-border px-6 py-3">
        <PromptSelector
          prompts={prompts}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {mapping && mapping.prompt ? (
          <>
            {/* Selected prompt card */}
            <div className="bg-bg-subtle border border-border rounded-md p-3 border-l-[3px] border-l-prompt">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-prompt/10 text-prompt">
                  Prompt
                </span>
                {mapping.prompt.model && (
                  <span className="text-[11px] text-text-muted font-mono">
                    {mapping.prompt.model}
                  </span>
                )}
              </div>
              <p className="text-[13px] text-text leading-relaxed whitespace-pre-wrap">
                {mapping.prompt.content}
              </p>
            </div>

            {/* Execution path */}
            <div>
              <h3 className="text-[12px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Execution Path
              </h3>
              <ExecutionPath events={mapping.executionPath} />
            </div>

            {/* Related changes */}
            <RelatedChanges diffs={mapping.relatedDiffs} />

            {/* Confidence notice */}
            <div className="flex items-start gap-2 text-[11px] text-text-muted mt-2 px-1">
              <span className="shrink-0 mt-px">ℹ</span>
              <span>
                Mappings are based on temporal proximity and are <strong>likely related changes</strong>,
                not provenance-tracked attributions. Verify before relying on them.
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-32 text-text-muted text-[13px]">
            {prompts.length === 0
              ? 'No user prompts in this session'
              : 'Select a prompt above to view its changes'}
          </div>
        )}
      </div>
    </div>
  );
}
