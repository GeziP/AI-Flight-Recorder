import { readEventsFile } from '@/lib/jsonl-reader';
import { discoverProjects, discoverSessions, formatSessionDate } from '@/lib/session-discovery';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TimelineView } from '@/components/timeline/timeline-view';

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ project: string; session: string }>;
}) {
  const { project: rawProject, session: sessionName } = await params;
  const project = decodeURIComponent(rawProject);
  const projects = await discoverProjects();
  const projectInfo = projects.find(p => p.name === project);
  const aifrDir = projectInfo?.dir;

  // Find the session directory
  const sessions = aifrDir ? await discoverSessions(aifrDir) : [];
  const sessionInfo = sessions.find(s => s.name === sessionName);
  const sessionDir = sessionInfo?.dir;

  if (!sessionDir) {
    return (
      <div className="flex-1 p-8">
        <p className="text-text-muted">Session not found.</p>
      </div>
    );
  }

  const eventsResult = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
  const events = eventsResult.events;

  let metadata: { agentType: string; gitBranch: string; eventCount: number; durationMs?: number } | undefined;
  try {
    const content = await readFile(path.join(sessionDir, 'metadata.json'), 'utf-8');
    const meta = JSON.parse(content);
    metadata = {
      agentType: meta.agentType ?? 'unknown',
      gitBranch: meta.gitBranch ?? 'unknown',
      eventCount: meta.eventCount ?? events.length,
      durationMs: meta.durationMs,
    };
  } catch {}

  return (
    <TimelineView
      events={events}
      sessionName={formatSessionDate(sessionName)}
      metadata={metadata}
    />
  );
}
