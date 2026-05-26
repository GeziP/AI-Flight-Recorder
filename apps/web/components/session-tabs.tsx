'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Timeline', path: '' },
  { label: 'Prompt-to-Diff', path: '/prompt-to-diff' },
  { label: 'Replay', path: '/replay' },
  { label: 'Diff', path: '/diff' },
  { label: 'Events', path: '/events' },
];

interface SessionTabsProps {
  project: string;
  session: string;
}

export function SessionTabs({ project, session }: SessionTabsProps) {
  const pathname = usePathname();
  const basePath = `/${project}/${session}`;

  return (
    <div className="h-11 border-b border-border flex items-center px-6 gap-1">
      {TABS.map((tab) => {
        const href = `${basePath}${tab.path}`;
        const isActive = pathname === href || (tab.path === '' && pathname === basePath);
        return (
          <Link
            key={tab.path}
            href={href}
            className={`px-3 py-[6px] text-[13px] ${
              isActive
                ? 'text-text font-medium border-b-2 border-text -mb-[1px]'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
