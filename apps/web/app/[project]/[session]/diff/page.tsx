export const dynamic = 'force-dynamic';

import { readEventsFile } from '@/lib/jsonl-reader';
import { resolveSessionDir } from '@/lib/project-resolver';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { DiffEvent, DiffFileChange } from '@aifr/event-schema';
import DiffClient from './client';

function parseFilesFromPatch(patch: string): DiffFileChange[] {
  const files: DiffFileChange[] = [];
  const fileMap = new Map<string, { additions: number; deletions: number; status: string }>();

  const sections = patch.split(/(?=^diff --git )/m);
  for (const section of sections) {
    const headerMatch = section.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    if (!headerMatch) continue;
    const filePath = headerMatch[2];
    let additions = 0;
    let deletions = 0;
    let status = 'modified';
    if (/^new file/m.test(section)) status = 'added';
    else if (/^deleted file/m.test(section)) status = 'deleted';
    else if (/^similarity index.*^rename from/m.test(section)) status = 'renamed';

    for (const line of section.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++;
      if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    }
    fileMap.set(filePath, { additions, deletions, status });
  }

  for (const [path, info] of fileMap) {
    files.push({
      path,
      status: info.status as DiffFileChange['status'],
      additions: info.additions,
      deletions: info.deletions,
    });
  }
  return files;
}

export default async function DiffPage({
  params,
}: {
  params: Promise<{ project: string; session: string }>;
}) {
  const { project, session } = await params;
  const sessionDir = await resolveSessionDir(project, session);
  if (!sessionDir) return <div className="p-8 text-text-muted">Session not found.</div>;

  const result = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
  const diffEvents = result.events.filter(
    (e): e is DiffEvent => e.type === 'diff' && !e.isBaseline,
  );
  let allFiles = diffEvents.flatMap((d) => d.files);

  // Get patch: from DiffEvent.patch first, fallback to git/after.patch file
  let patch = diffEvents.find(d => d.patch)?.patch ?? '';
  if (!patch) {
    try {
      patch = await readFile(path.join(sessionDir, 'git', 'after.patch'), 'utf-8');
    } catch {}
  }

  // If files list is empty but patch has content, parse file names from the patch
  if (allFiles.length === 0 && patch.trim()) {
    allFiles = parseFilesFromPatch(patch);
  }

  return <DiffClient files={allFiles} patch={patch} />;
}
