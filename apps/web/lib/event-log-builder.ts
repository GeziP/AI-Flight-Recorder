import type { AIFREvent, PromptEvent, CommandEvent, ToolEvent, DiffEvent, TestEvent, SessionEvent } from '@aifr/event-schema';

function isPromptEvent(e: AIFREvent): e is PromptEvent { return e.type === 'prompt'; }
function isCommandEvent(e: AIFREvent): e is CommandEvent { return e.type === 'command'; }
function isToolEvent(e: AIFREvent): e is ToolEvent { return e.type === 'tool'; }
function isDiffEvent(e: AIFREvent): e is DiffEvent { return e.type === 'diff'; }
function isTestEvent(e: AIFREvent): e is TestEvent { return e.type === 'test'; }
function isSessionEvent(e: AIFREvent): e is SessionEvent { return e.type === 'session'; }

export function buildEventLog(events: AIFREvent[]): string {
  const lines: string[] = [];
  for (const e of events) {
    const ts = new Date(e.timestamp).toLocaleTimeString();
    if (isPromptEvent(e)) {
      if (e.role === 'user') {
        lines.push(`[${ts}] > ${e.content.slice(0, 200)}`);
      } else if (e.role === 'assistant') {
        lines.push(`[${ts}] ${e.content.slice(0, 200)}`);
      }
    } else if (isCommandEvent(e)) {
      lines.push(`[${ts}] $ ${e.command}`);
    } else if (isToolEvent(e)) {
      lines.push(`[${ts}] [tool] ${e.name}`);
    } else if (isDiffEvent(e)) {
      lines.push(`[${ts}] [diff] ${e.files.length} file(s) changed`);
    } else if (isTestEvent(e)) {
      lines.push(`[${ts}] [test] ${e.outcome.toUpperCase()}`);
    } else if (e.type === 'retry') {
      lines.push(`[${ts}] [retry]`);
    } else if (isSessionEvent(e)) {
      lines.push(`[${ts}] === session ${e.subtype ?? ''} ===`);
    }
  }
  return lines.join('\n') + '\n';
}
