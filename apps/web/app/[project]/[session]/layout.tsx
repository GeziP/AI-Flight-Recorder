import { SessionTabs } from '@/components/session-tabs';

export default async function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ project: string; session: string }>;
}) {
  const { project, session } = await params;

  return (
    <>
      <SessionTabs project={project} session={session} />
      <div className="flex-1 overflow-hidden">{children}</div>
    </>
  );
}
