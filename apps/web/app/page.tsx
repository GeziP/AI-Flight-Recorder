import Link from 'next/link';
import { discoverProjects } from '@/lib/session-discovery';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const projects = await discoverProjects();

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-text text-center">AIFR</h1>
        <p className="text-text-secondary text-center mt-2">AI Flight Recorder</p>
        <p className="text-text-muted text-[13px] text-center mt-1">
          Record, replay, and analyze AI-assisted development workflows
        </p>

        {projects.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-text-muted text-[13px]">No projects found.</p>
            <p className="text-text-muted text-[12px] mt-2">
              Run <code className="text-accent-blue">aifr init</code> in a project directory, or{' '}
              <code className="text-accent-blue">aifr import claude</code> to import sessions.
            </p>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-2">
            <div className="text-[11px] text-text-muted uppercase tracking-[0.04em] px-1">Projects</div>
            {projects.map((project) => (
              <Link
                key={project.name}
                href={`/${project.name}`}
                className="px-4 py-3 border border-border rounded-lg hover:bg-bg-subtle transition-colors"
              >
                <div className="text-[13px] font-medium text-text">{project.name}</div>
                <div className="text-[12px] text-text-muted mt-1">
                  {project.sessionCount} session{project.sessionCount !== 1 ? 's' : ''}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
