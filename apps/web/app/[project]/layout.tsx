import { Sidebar } from '@/components/sidebar';
import { discoverSessions } from '@/lib/session-discovery';
import { MOCK_SESSIONS_DIR } from '@/lib/mock-data';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  const sessions = await discoverSessions(MOCK_SESSIONS_DIR);

  return (
    <div className="flex h-screen">
      <Sidebar projectName={project} sessions={sessions} />
      <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
    </div>
  );
}
