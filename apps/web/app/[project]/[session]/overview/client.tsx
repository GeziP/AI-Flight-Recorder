'use client';

interface OverviewClientProps {
  analysis: Record<string, unknown> | undefined;
  eventCount: number;
  metadata: Record<string, unknown>;
}

export function OverviewClient({ analysis, eventCount, metadata }: OverviewClientProps) {
  const summary = analysis?.summary as Record<string, unknown> | undefined;
  const attribution = analysis?.attribution as Record<string, unknown> | undefined;
  const retryGroups = (analysis?.retryGroups as Array<Record<string, unknown>>) ?? [];
  const warnings = (analysis?.warnings as Array<Record<string, unknown>>) ?? [];

  if (!analysis) {
    return (
      <div className="flex-1 p-8">
        <div className="text-text-muted">
          No analysis data available. Run <code className="bg-card px-1.5 py-0.5 rounded text-xs">aifr analyze {String(metadata.sessionId ?? '')}</code> to generate.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-medium">Session Overview</h2>
        <p className="text-sm text-text-muted mt-1">
          {String(metadata.agentType ?? 'unknown')} agent &middot; {eventCount} events
          {metadata.durationMs ? ` · ${formatDuration(Number(metadata.durationMs))}` : ''}
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Prompts" value={String(summary.totalPrompts ?? 0)} />
          <MetricCard label="Commands" value={String(summary.totalCommands ?? 0)} />
          <MetricCard label="Files Changed" value={String(summary.totalDiffFiles ?? 0)} />
          <MetricCard label="Code Changes" value={`+${summary.totalAdditions ?? 0} / -${summary.totalDeletions ?? 0}`} />
          <MetricCard label="Tests Passed" value={String(summary.testsPassed ?? 0)} color="green" />
          <MetricCard label="Tests Failed" value={String(summary.testsFailed ?? 0)} color={Number(summary.testsFailed) > 0 ? 'red' : undefined} />
          <MetricCard label="Retries" value={String(summary.retryCount ?? 0)} color={Number(summary.retryCount) > 0 ? 'yellow' : undefined} />
          <MetricCard label="Baseline Diff" value={summary.hasBaselineDiff ? 'Yes' : 'No'} />
        </div>
      )}

      {/* Attribution */}
      {attribution && (
        <div>
          <h3 className="text-sm font-medium mb-2">Prompt-to-Diff Attribution</h3>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-baseline gap-6 text-sm">
              <span>
                <span className="text-text-muted">Total Diffs:</span>{' '}
                <span className="font-medium">{String(attribution.totalDiffs)}</span>
              </span>
              <span>
                <span className="text-text-muted">Attributed:</span>{' '}
                <span className="font-medium">{String(attribution.attributed)}</span>
              </span>
              <span>
                <span className="text-text-muted">Unattributed:</span>{' '}
                <span className="font-medium">{String(attribution.unattributed)}</span>
              </span>
            </div>
            {attribution.byConfidence != null && (
              <div className="flex gap-4 mt-3 text-xs">
                <ConfidenceBar label="High" count={Number((attribution.byConfidence as Record<string, number>).high ?? 0)} color="bg-green-500" total={Number(attribution.totalDiffs) || 1} />
                <ConfidenceBar label="Medium" count={Number((attribution.byConfidence as Record<string, number>).medium ?? 0)} color="bg-yellow-500" total={Number(attribution.totalDiffs) || 1} />
                <ConfidenceBar label="Low" count={Number((attribution.byConfidence as Record<string, number>).low ?? 0)} color="bg-red-400" total={Number(attribution.totalDiffs) || 1} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Retry Analysis */}
      {retryGroups.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Retry Analysis</h3>
          <div className="space-y-2">
            {retryGroups.map((rg, i) => (
              <div key={String(rg.id ?? i)} className="bg-card border border-border rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500">↻</span>
                  <span className="font-medium">{String(rg.id)}</span>
                  <span className="text-text-muted">—</span>
                  <span className="text-text-muted">Failure: {String(rg.failureNodeId)}</span>
                  {rg.successNodeId != null && <span className="text-green-500 ml-2">Resolved</span>}
                </div>
                {Array.isArray(rg.hotspotFiles) && rg.hotspotFiles.length > 0 && (
                  <div className="mt-1.5 text-xs text-text-muted">
                    Hotspot: {(rg.hotspotFiles as string[]).map(f => (
                      <code key={f} className="bg-card px-1 py-0.5 rounded ml-1">{f}</code>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Warnings</h3>
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="text-sm text-yellow-600 flex items-start gap-2">
                <span>!</span>
                <span>[{String(w.code)}] {String(w.message)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorMap: Record<string, string> = {
    green: 'text-green-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
  };
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`text-lg font-medium mt-0.5 ${color && colorMap[color] ? colorMap[color] : ''}`}>
        {value}
      </div>
    </div>
  );
}

function ConfidenceBar({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex-1">
      <div className="flex justify-between mb-1">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}
