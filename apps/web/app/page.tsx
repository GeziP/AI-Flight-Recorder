import Link from 'next/link';
import { MOCK_SESSIONS } from '@/lib/mock-data';

export default function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-text text-center">AIFR</h1>
        <p className="text-text-secondary text-center mt-2">AI Flight Recorder</p>
        <p className="text-text-muted text-[13px] text-center mt-1">
          Record, replay, and analyze AI-assisted development workflows
        </p>

        <div className="mt-8 flex flex-col gap-2">
          <div className="text-[11px] text-text-muted uppercase tracking-[0.04em] px-1">Demo Sessions</div>
          {MOCK_SESSIONS.map((s) => (
            <Link
              key={s.name}
              href={`/demo/${s.name}`}
              className="px-4 py-3 border border-border rounded-lg hover:bg-bg-subtle transition-colors"
            >
              <div className="text-[13px] font-medium text-text">{s.label}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
