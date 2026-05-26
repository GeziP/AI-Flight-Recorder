'use client';

import { useState } from 'react';
import type { DiffFileChange } from '@aifr/event-schema';
import { FileTabs } from '@/components/diff/file-tabs';
import { DiffViewer } from '@/components/diff/diff-viewer';

export default function DiffClient({
  files,
  patch,
}: {
  files: DiffFileChange[];
  patch: string;
}) {
  const [selected, setSelected] = useState(files[0]?.path ?? '');

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        No diffs in this session
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <FileTabs files={files} selected={selected} onSelect={setSelected} />
      <div className="flex-1 overflow-auto">
        <DiffViewer patch={patch} fileName={selected} />
      </div>
    </div>
  );
}
