import type {
  AIFREvent,
  PromptEvent,
  DiffEvent,
  ToolEvent,
  TestEvent,
  RetryEvent,
  CommandEvent,
} from '@aifr/event-schema';

export interface PromptMappingResult {
  prompt: PromptEvent | null;
  nextPrompt: PromptEvent | null;
  executionPath: AIFREvent[];
  relatedDiffs: DiffEvent[];
}

export function mapPromptToChanges(events: AIFREvent[], promptId: string): PromptMappingResult {
  const promptIndex = events.findIndex((e) => e.id === promptId);
  if (promptIndex === -1) {
    return { prompt: null, nextPrompt: null, executionPath: [], relatedDiffs: [] };
  }

  const prompt = events[promptIndex] as PromptEvent;

  let nextPromptIndex = events.findIndex(
    (e, i) => i > promptIndex && e.type === 'prompt' && (e as PromptEvent).role === 'user',
  );
  if (nextPromptIndex === -1) nextPromptIndex = events.length;

  const nextPrompt = nextPromptIndex < events.length ? (events[nextPromptIndex] as PromptEvent) : null;

  const between = events.slice(promptIndex + 1, nextPromptIndex);

  const relatedDiffs = between.filter(
    (e): e is DiffEvent => e.type === 'diff' && !(e as DiffEvent).isBaseline,
  );

  const executionPath = between.filter(
    (e): e is ToolEvent | DiffEvent | TestEvent | RetryEvent | CommandEvent =>
      ['tool', 'diff', 'test', 'retry', 'command'].includes(e.type),
  );

  return { prompt, nextPrompt, executionPath, relatedDiffs };
}

export function findAllPrompts(events: AIFREvent[]): PromptEvent[] {
  return events.filter((e): e is PromptEvent => e.type === 'prompt' && e.role === 'user');
}
