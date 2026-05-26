import { discoverSessions, formatSessionDate } from '@/lib/session-discovery';
import { MOCK_SESSIONS_DIR } from '@/lib/mock-data';
import Link from 'next/link';

export default async function SessionListPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  const sessions = await discoverSessions(MOCK_SESSIONS_DIR);

  return (
    <div className="flex-1 overflow-auto p-8">
      <h1 className="text-lg font-semibold tracking-tight text-text">Sessions</h1>
      <p className="text-[13px] text-text-muted mt-1">{project}</p>
      <div className="mt-6 flex flex-col gap-2">
        {sessions.map((session) => {
          const meta = session.metadata;
          return (
            <Link
              key={session.name}
              href={`/${project}/${session.name}`}
              className="px-4 py-3 border border-border rounded-lg hover:bg-bg-subtle transition-colors"
            >
              <div className="text-[13px] font-medium text-text">
                {formatSessionDate(session.name)}
              </div>
              {meta && (
                <div className="text-[12px] text-text-muted mt-1">
                  {meta.agentType} · {meta.status} · {meta.eventCount} events
                  {meta.durationMs && ` · ${Math.round(meta.durationMs / 60000)}m`}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
