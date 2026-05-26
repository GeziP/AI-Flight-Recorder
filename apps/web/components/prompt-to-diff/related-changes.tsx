import type { DiffEvent, DiffFileChange } from '@aifr/event-schema';

function statusLetter(status: string): string {
  switch (status) {
    case 'added':
      return 'A';
    case 'modified':
      return 'M';
    case 'deleted':
      return 'D';
    case 'renamed':
      return 'R';
    default:
      return '?';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'added':
      return 'text-test-pass';
    case 'deleted':
      return 'text-test-fail';
    default:
      return 'text-diff';
  }
}

function FileChangeCard({ file }: { file: DiffFileChange }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-subtle rounded text-[12px]">
      <span className={`font-bold w-4 text-center ${statusColor(file.status)}`}>
        {statusLetter(file.status)}
      </span>
      <span className="font-mono text-text-secondary truncate flex-1 min-w-0">{file.path}</span>
      <span className="text-test-pass text-[11px] tabular-nums">+{file.additions}</span>
      <span className="text-test-fail text-[11px] tabular-nums">-{file.deletions}</span>
    </div>
  );
}

interface RelatedChangesProps {
  diffs: DiffEvent[];
}

export function RelatedChanges({ diffs }: RelatedChangesProps) {
  const allFiles = diffs.flatMap((d) => d.files);
  const totalAdd = diffs.reduce((sum, d) => sum + d.totalAdditions, 0);
  const totalDel = diffs.reduce((sum, d) => sum + d.totalDeletions, 0);

  if (diffs.length === 0) {
    return (
      <div className="text-[13px] text-text-muted py-2">
        No code changes detected for this prompt
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-[13px] font-medium text-text">Likely Related Changes</h3>
        <span className="group relative inline-flex items-center">
          <svg
            className="w-3.5 h-3.5 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[11px] text-text bg-bg-subtle border border-border rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Mapping is inferred from timestamp proximity
          </span>
        </span>
        <div className="flex items-center gap-1.5 ml-auto text-[11px]">
          <span className="text-test-pass tabular-nums">+{totalAdd}</span>
          <span className="text-test-fail tabular-nums">-{totalDel}</span>
          <span className="text-text-muted">
            {allFiles.length} file{allFiles.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="space-y-1">
        {allFiles.map((file) => (
          <FileChangeCard key={file.path} file={file} />
        ))}
      </div>
    </div>
  );
}
