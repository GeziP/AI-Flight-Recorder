import { SessionTabs } from '@/components/session-tabs';

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
      <SessionTabs project={project} session={session} />
      <div className="flex-1 flex flex-col overflow-auto">{children}</div>
    </>
  );
}
