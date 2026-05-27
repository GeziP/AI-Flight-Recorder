import { readEventsFile } from '@/lib/jsonl-reader';
import { resolveSessionDir } from '@/lib/project-resolver';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { DiffEvent } from '@aifr/event-schema';
import DiffClient from './client';

export default async function DiffPage({
  params,
}: {
  params: Promise<{ project: string; session: string }>;
}) {
  const { project, session } = await params;
  const sessionDir = await resolveSessionDir(decodeURIComponent(project), session);
  if (!sessionDir) return <div className="p-8 text-text-muted">Session not found.</div>;

  const result = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
  const diffEvents = result.events.filter(
    (e): e is DiffEvent => e.type === 'diff' && !e.isBaseline,
  );
  const allFiles = diffEvents.flatMap((d) => d.files);
  let patch = '';
  try {
    patch = await readFile(path.join(sessionDir, 'git', 'after.patch'), 'utf-8');
  } catch {}
  return <DiffClient files={allFiles} patch={patch} />;
}
