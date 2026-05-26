import { readEventsFile } from '@/lib/jsonl-reader';
import { MOCK_SESSIONS_DIR } from '@/lib/mock-data';
import path from 'node:path';
import PromptToDiffClient from './client';

export default async function PromptToDiffPage({
  params,
}: {
  params: Promise<{ project: string; session: string }>;
}) {
  const { session } = await params;
  const result = await readEventsFile(
    path.join(MOCK_SESSIONS_DIR, session, 'events.jsonl'),
  );
  return <PromptToDiffClient events={result.events} />;
}
