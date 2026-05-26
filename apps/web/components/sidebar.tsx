import Link from 'next/link';
import { formatSessionDate } from '@/lib/session-discovery';
import type { DiscoveredSession } from '@/lib/session-discovery';

interface SidebarProps {
  projectName: string;
  sessions: DiscoveredSession[];
  currentSession?: string;
}

export function Sidebar({ projectName, sessions, currentSession }: SidebarProps) {
  return (
    <aside className="w-[220px] h-screen border-r border-border flex flex-col bg-bg shrink-0">
      <div className="px-5 py-5 font-semibold text-[13px] text-text tracking-[-0.01em] border-b border-border">
        AIFR
      </div>
      <div className="px-3 pt-4 pb-1 text-[11px] text-text-muted font-medium uppercase tracking-[0.04em]">
        Project
      </div>
      <div className="px-3">
        <div className="px-[10px] py-[7px] bg-bg-subtle rounded-md text-[13px] text-text font-medium">
          {projectName}
        </div>
      </div>
      <div className="px-3 pt-6 pb-1 text-[11px] text-text-muted font-medium uppercase tracking-[0.04em]">
        Sessions
      </div>
      <nav className="px-3 flex flex-col gap-[2px] flex-1 overflow-y-auto">
        {sessions.map((session) => {
          const isActive = session.name === currentSession;
          const label = formatSessionDate(session.name);
          const meta = session.metadata;
          return (
            <Link
              key={session.name}
              href={`/${projectName}/${session.name}`}
              className={`px-[10px] py-[7px] text-[13px] rounded-md ${
                isActive
                  ? 'text-text font-medium bg-bg-subtle'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              {label}
              {meta && (
                <span className="block text-[11px] text-text-muted mt-[2px]">
                  {meta.agentType} · {meta.status}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-border text-[11px] text-text-muted">
        AI Flight Recorder v0.1
      </div>
    </aside>
  );
}
