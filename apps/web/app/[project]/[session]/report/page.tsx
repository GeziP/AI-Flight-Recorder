import { loadSessionData } from '@/lib/load-session-data';
import { ReportClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ReportPage({
  params,
}: {
  params: Promise<{ project: string; session: string }>;
}) {
  const { project: rawProject, session: sessionName } = await params;
  const project = decodeURIComponent(rawProject);

  const data = await loadSessionData(project, sessionName, { report: true });
  if (!data.sessionDir) {
    return <div className="flex-1 p-8 text-text-muted">Session not found.</div>;
  }

  return <ReportClient report={data.report as string | undefined} />;
}
