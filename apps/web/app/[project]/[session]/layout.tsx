import { SessionTabs } from '@/components/session-tabs';
import Link from 'next/link';

export default async function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ project: string; session: string }>;
}) {
  const { project: rawProject, session } = await params;
  const project = decodeURIComponent(rawProject);

  return (
    <>
      <div className="h-7 border-b border-border flex items-center px-6 gap-1.5 text-[11px] text-text-muted shrink-0">
        <Link href="/" className="hover:text-text-secondary">Home</Link>
        <span>/</span>
        <Link href={`/${rawProject}`} className="hover:text-text-secondary">{project}</Link>
        <span>/</span>
        <span className="text-text-secondary font-mono">{session}</span>
      </div>
      <SessionTabs project={project} session={session} />
      <div className="flex-1 flex flex-col overflow-auto">{children}</div>
    </>
  );
}
