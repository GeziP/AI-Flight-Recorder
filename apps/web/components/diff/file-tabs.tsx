'use client';

import type { DiffFileChange } from '@aifr/event-schema';

interface FileTabsProps {
  files: DiffFileChange[];
  selected: string;
  onSelect: (path: string) => void;
}

const STATUS_CONFIG: Record<string, { letter: string; color: string }> = {
  modified: { letter: 'M', color: 'text-amber-500' },
  added: { letter: 'A', color: 'text-test-pass' },
  deleted: { letter: 'D', color: 'text-test-fail' },
  renamed: { letter: 'R', color: 'text-tool' },
};

function basename(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

export function FileTabs({ files, selected, onSelect }: FileTabsProps) {
  return (
    <div className="h-10 border-b border-border flex items-center overflow-x-auto shrink-0">
      {files.map((file) => {
        const isActive = file.path === selected;
        const config = STATUS_CONFIG[file.status] ?? STATUS_CONFIG.modified;
        const fileName = basename(file.path);

        return (
          <button
            key={file.path}
            onClick={() => onSelect(file.path)}
            className={`flex items-center gap-1.5 px-3 h-full text-[13px] border-r border-border whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-bg-subtle text-text font-medium'
                : 'text-text-secondary hover:text-text hover:bg-bg-subtle/50'
            }`}
          >
            <span className={`font-mono text-[11px] font-semibold ${config.color}`}>
              {config.letter}
            </span>
            <span className="font-mono">{fileName}</span>
            <span className="text-[11px] text-text-muted ml-1">
              <span className="text-green-700">+{file.additions}</span>
              {' / '}
              <span className="text-red-700">-{file.deletions}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
