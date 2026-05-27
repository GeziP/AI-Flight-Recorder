import { readEventsFile } from '@/lib/jsonl-reader';
import { resolveSessionDir } from '@/lib/project-resolver';
import path from 'node:path';
import PromptToDiffClient from './client';

export default async function PromptToDiffPage({
  params,
}: {
  params: Promise<{ project: string; session: string }>;
}) {
  const { project, session } = await params;
  const sessionDir = await resolveSessionDir(decodeURIComponent(project), session);
  if (!sessionDir) return <div className="p-8 text-text-muted">Session not found.</div>;
  const result = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
  return <PromptToDiffClient events={result.events} />;
}
