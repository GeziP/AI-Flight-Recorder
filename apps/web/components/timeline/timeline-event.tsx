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

// ---- Duration formatting ----

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${secs}s`;
}

// ---- Timestamp formatting ----

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ---- Event type config ----

const TYPE_CONFIG: Record<string, { label: string; color: string; dotClass: string; labelClass: string }> = {
  session:   { label: 'SESSION',   color: '#171717', dotClass: 'bg-text',       labelClass: 'text-text' },
  prompt:    { label: 'PROMPT',    color: '#6366f1', dotClass: 'bg-prompt',     labelClass: 'text-prompt' },
  command:   { label: 'COMMAND',   color: '#171717', dotClass: 'bg-text',       labelClass: 'text-text' },
  diff:      { label: 'DIFF',      color: '#f59e0b', dotClass: 'bg-diff',      labelClass: 'text-diff' },
  tool:      { label: 'TOOL',      color: '#06b6d4', dotClass: 'bg-tool',      labelClass: 'text-tool' },
  test:      { label: 'TEST',      color: '#22c55e', dotClass: 'bg-test-pass',  labelClass: 'text-test-pass' },
  terminal_output: { label: 'OUTPUT', color: '#171717', dotClass: 'bg-text',   labelClass: 'text-text' },
  retry:     { label: 'RETRY',     color: '#8b5cf6', dotClass: 'bg-retry',     labelClass: 'text-retry' },
};

// ---- Diff file status helpers ----

function statusLetter(status: string): string {
  switch (status) {
    case 'added': return 'A';
    case 'modified': return 'M';
    case 'deleted': return 'D';
    case 'renamed': return 'R';
    default: return '?';
  }
}

// ---- Event-specific renderers ----

function SessionCard({ event }: { event: SessionEvent }) {
  if (event.subtype === 'start') {
    return (
      <div className="text-[13px] text-text-secondary">
        Session started &mdash; <span className="font-mono text-[12px]">{event.agentType}</span> on{' '}
        <span className="font-mono text-[12px]">{event.gitBranch}</span>
      </div>
    );
  }
  // end
  return (
    <div className="text-[13px] text-text-secondary">
      Session {event.status} &mdash; {formatDuration(event.durationMs)}, {event.eventCount} events
    </div>
  );
}

function PromptCard({ event }: { event: PromptEvent }) {
  return (
    <div className="bg-bg-subtle border border-border rounded-md p-3 border-l-[3px] border-l-prompt">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[11px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-prompt/10 ${TYPE_CONFIG.prompt.labelClass}`}>
          {event.role}
        </span>
        {event.model && (
          <span className="text-[11px] text-text-muted font-mono">{event.model}</span>
        )}
      </div>
      <p className="text-[13px] text-text leading-relaxed whitespace-pre-wrap">{event.content}</p>
    </div>
  );
}

function CommandCard({ event }: { event: CommandEvent }) {
  const exitOk = event.exitCode === 0;
  return (
    <div>
      <div className="bg-[#0a0a0a] rounded-md p-3 font-mono text-[13px] text-[#e0e0e0] leading-relaxed overflow-x-auto">
        <span className="text-text-muted">$</span> {event.command}
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        {event.exitCode !== undefined && (
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
            exitOk ? 'bg-test-pass/10 text-test-pass' : 'bg-test-fail/10 text-test-fail'
          }`}>
            exit {event.exitCode}
          </span>
        )}
        {event.durationMs !== undefined && (
          <span className="text-[11px] text-text-muted">{formatDuration(event.durationMs)}</span>
        )}
      </div>
    </div>
  );
}

function DiffCard({ event }: { event: DiffEvent }) {
  return (
    <div className="bg-[#fffbeb] border border-diff/20 rounded-md p-3">
      <div className="flex items-center gap-3 mb-2 text-[12px]">
        <span className="text-test-pass font-mono">+{event.totalAdditions}</span>
        <span className="text-test-fail font-mono">-{event.totalDeletions}</span>
        <span className="text-text-muted">{event.files.length} file{event.files.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-1">
        {event.files.map((file) => (
          <div key={file.path} className="flex items-center gap-2 text-[12px] font-mono">
            <span className={`font-medium w-4 text-center ${
              file.status === 'added' ? 'text-test-pass' :
              file.status === 'deleted' ? 'text-test-fail' :
              'text-diff'
            }`}>
              {statusLetter(file.status)}
            </span>
            <span className="text-text-secondary truncate">{file.path}</span>
            <span className="text-test-pass text-[11px]">+{file.additions}</span>
            <span className="text-test-fail text-[11px]">-{file.deletions}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolCard({ event }: { event: ToolEvent }) {
  const filePath = (event.input?.file_path ?? event.input?.filePath) as string | undefined;
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-tool/10 text-tool">{event.name}</span>
      {filePath && (
        <span className="font-mono text-[12px] text-text-secondary truncate">{filePath}</span>
      )}
      {event.durationMs !== undefined && (
        <span className="text-[11px] text-text-muted">{formatDuration(event.durationMs)}</span>
      )}
    </div>
  );
}

function TestCard({ event }: { event: TestEvent }) {
  const passed = event.outcome === 'pass';
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
        passed ? 'bg-test-pass/10 text-test-pass' : 'bg-test-fail/10 text-test-fail'
      }`}>
        {event.outcome.toUpperCase()}
      </span>
      {event.totalTests !== undefined && (
        <span className="text-[12px] text-text-secondary">
          {event.passed ?? 0} passed, {event.failed ?? 0} failed
        </span>
      )}
      {event.durationMs !== undefined && (
        <span className="text-[11px] text-text-muted">{formatDuration(event.durationMs)}</span>
      )}
    </div>
  );
}

function TerminalOutputCard({ event }: { event: TerminalOutputEvent }) {
  const truncated = event.content.length > 200 ? event.content.slice(0, 200) + '...' : event.content;
  return (
    <div className="text-[13px] text-text-secondary font-mono whitespace-pre-wrap break-all leading-relaxed">
      {truncated}
    </div>
  );
}

function RetryCard({ event }: { event: RetryEvent }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-retry/10 text-retry">
        Attempt {event.attemptNumber}{event.maxAttempts ? ` / ${event.maxAttempts}` : ''}
      </span>
      <span className="text-text-secondary">{event.reason}</span>
    </div>
  );
}

// ---- Main component ----

interface TimelineEventRowProps {
  event: AIFREvent;
  isLast: boolean;
}

export function TimelineEventRow({ event, isLast }: TimelineEventRowProps) {
  const config = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.session;
  // For test events, adjust color based on outcome
  let dotClass = config.dotClass;
  let labelClass = config.labelClass;
  if (event.type === 'test') {
    const testEvt = event as TestEvent;
    if (testEvt.outcome !== 'pass') {
      dotClass = 'bg-test-fail';
      labelClass = 'text-test-fail';
    }
  }

  return (
    <div className="flex gap-4 group">
      {/* Timestamp column */}
      <div className="w-[58px] shrink-0 pt-[5px]">
        <span className="text-[12px] text-text-muted tabular-nums font-mono">
          {formatTimestamp(event.timestamp)}
        </span>
      </div>

      {/* Dot + line column */}
      <div className="w-[16px] shrink-0 flex flex-col items-center">
        <div className={`w-[9px] h-[9px] rounded-full shrink-0 mt-[7px] ${dotClass}`} />
        {!isLast && (
          <div className="w-px flex-1 bg-border mt-1" />
        )}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${labelClass}`}>
            {config.label}
          </span>
          {event.type === 'session' && 'subtype' in event && (
            <span className="text-[11px] text-text-muted">
              {(event as SessionEvent).subtype}
            </span>
          )}
        </div>
        {renderCardContent(event)}
      </div>
    </div>
  );
}

function renderCardContent(event: AIFREvent) {
  switch (event.type) {
    case 'session':         return <SessionCard event={event as SessionEvent} />;
    case 'prompt':          return <PromptCard event={event as PromptEvent} />;
    case 'command':         return <CommandCard event={event as CommandEvent} />;
    case 'diff':            return <DiffCard event={event as DiffEvent} />;
    case 'tool':            return <ToolCard event={event as ToolEvent} />;
    case 'test':            return <TestCard event={event as TestEvent} />;
    case 'terminal_output': return <TerminalOutputCard event={event as TerminalOutputEvent} />;
    case 'retry':           return <RetryCard event={event as RetryEvent} />;
    default:                return <div className="text-[12px] text-text-muted">Unknown event</div>;
  }
}
