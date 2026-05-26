import type {
  AIFREvent,
  ToolEvent,
  DiffEvent,
  TestEvent,
  RetryEvent,
  CommandEvent,
} from '@aifr/event-schema';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m`;
}

function ToolBadge({ event }: { event: ToolEvent }) {
  const filePath = (event.input?.file_path ?? event.input?.filePath) as string | undefined;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#ecfeff] text-tool">
      {event.name}
      {filePath && (
        <span className="font-mono text-[10px] opacity-70 max-w-[80px] truncate">{filePath}</span>
      )}
      {event.durationMs !== undefined && (
        <span className="text-[10px] opacity-60">{formatDuration(event.durationMs)}</span>
      )}
    </span>
  );
}

function DiffBadge({ event }: { event: DiffEvent }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#fffbeb] text-diff">
      Diff
      <span className="text-test-pass text-[10px]">+{event.totalAdditions}</span>
      <span className="text-test-fail text-[10px]">-{event.totalDeletions}</span>
    </span>
  );
}

function TestBadge({ event }: { event: TestEvent }) {
  const passed = event.outcome === 'pass';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
        passed ? 'bg-[#f0fdf4] text-test-pass' : 'bg-[#fef2f2] text-test-fail'
      }`}
    >
      {passed ? 'PASS' : 'FAIL'}
      {event.totalTests !== undefined && (
        <span className="text-[10px] opacity-70">
          {event.passed ?? 0}/{event.totalTests}
        </span>
      )}
    </span>
  );
}

function RetryBadge({ event }: { event: RetryEvent }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#faf5ff] text-retry">
      Retry #{event.attemptNumber}
      {event.maxAttempts && (
        <span className="text-[10px] opacity-70">/{event.maxAttempts}</span>
      )}
    </span>
  );
}

function CommandBadge({ event }: { event: CommandEvent }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-bg-subtle text-text-secondary">
      <span className="font-mono text-[10px] max-w-[120px] truncate">{event.command}</span>
    </span>
  );
}

function EventBadge({ event }: { event: AIFREvent }) {
  switch (event.type) {
    case 'tool':
      return <ToolBadge event={event as ToolEvent} />;
    case 'diff':
      return <DiffBadge event={event as DiffEvent} />;
    case 'test':
      return <TestBadge event={event as TestEvent} />;
    case 'retry':
      return <RetryBadge event={event as RetryEvent} />;
    case 'command':
      return <CommandBadge event={event as CommandEvent} />;
    default:
      return null;
  }
}

interface ExecutionPathProps {
  events: AIFREvent[];
}

export function ExecutionPath({ events }: ExecutionPathProps) {
  if (events.length === 0) {
    return (
      <div className="text-[13px] text-text-muted py-2">
        No tool calls or changes recorded for this prompt
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap py-2">
      {events.map((event, index) => (
        <span key={event.id} className="inline-flex items-center gap-1.5">
          <EventBadge event={event} />
          {index < events.length - 1 && (
            <span className="text-text-muted text-[12px]">&rarr;</span>
          )}
        </span>
      ))}
    </div>
  );
}
