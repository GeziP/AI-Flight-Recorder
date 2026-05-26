'use client';

import { useState, useMemo } from 'react';

interface DiffViewerProps {
  patch: string;
  fileName: string;
}

type ViewMode = 'side-by-side' | 'unified';

interface ParsedLine {
  type: 'added' | 'removed' | 'context' | 'hunk-header';
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

function parsePatchForFile(patch: string, fileName: string): ParsedLine[] {
  const lines = patch.split('\n');
  const result: ParsedLine[] = [];

  // Find the section of the patch that applies to the requested file
  let inTargetFile = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect start of a file diff section
    if (line.startsWith('diff --git')) {
      // Check if this diff section is for our file
      const parts = line.split(' ');
      // e.g. "diff --git a/foo.ts b/foo.ts"
      const fileB = parts[parts.length - 1];
      const bareName = fileB.replace(/^b\//, '');
      inTargetFile = bareName === fileName || fileB === fileName ||
        line.includes(`b/${fileName}`) || line.includes(`a/${fileName}`);
      i++;
      continue;
    }

    if (!inTargetFile) {
      i++;
      continue;
    }

    // Skip header lines
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file') || line.startsWith('similarity index')) {
      i++;
      continue;
    }

    // End of this file section (next diff or empty at end)
    if (line.startsWith('diff --git') || (line.trim() === '' && i + 1 < lines.length && lines[i + 1]?.startsWith('diff --git'))) {
      inTargetFile = false;
      continue;
    }

    // Hunk header
    if (line.startsWith('@@')) {
      result.push({ type: 'hunk-header', content: line });
      i++;
      continue;
    }

    // Removed line
    if (line.startsWith('-')) {
      result.push({ type: 'removed', content: line.slice(1) });
      i++;
      continue;
    }

    // Added line
    if (line.startsWith('+')) {
      result.push({ type: 'added', content: line.slice(1) });
      i++;
      continue;
    }

    // Context line (may start with space or be empty)
    result.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line });
    i++;
  }

  // If no specific file section was found, parse the entire patch as if it's for this file
  if (result.length === 0 && patch.length > 0) {
    for (const line of lines) {
      if (line.startsWith('diff --git') || line.startsWith('---') || line.startsWith('+++') || line.startsWith('index ')) {
        continue;
      }
      if (line.startsWith('@@')) {
        result.push({ type: 'hunk-header', content: line });
      } else if (line.startsWith('-')) {
        result.push({ type: 'removed', content: line.slice(1) });
      } else if (line.startsWith('+')) {
        result.push({ type: 'added', content: line.slice(1) });
      } else {
        result.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line });
      }
    }
  }

  return result;
}

export function DiffViewer({ patch, fileName }: DiffViewerProps) {
  const [mode, setMode] = useState<ViewMode>('side-by-side');

  const parsedLines = useMemo(() => parsePatchForFile(patch, fileName), [patch, fileName]);

  if (parsedLines.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted p-8">
        No diff available for {fileName}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mode toggle */}
      <div className="flex justify-end px-4 py-2 border-b border-border shrink-0">
        <div className="flex rounded-md bg-bg-subtle p-0.5">
          <button
            onClick={() => setMode('side-by-side')}
            className={`px-3 py-1 text-[12px] rounded-sm transition-colors ${
              mode === 'side-by-side'
                ? 'bg-white text-text shadow-sm font-medium'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            Side-by-side
          </button>
          <button
            onClick={() => setMode('unified')}
            className={`px-3 py-1 text-[12px] rounded-sm transition-colors ${
              mode === 'unified'
                ? 'bg-white text-text shadow-sm font-medium'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            Unified
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        {mode === 'side-by-side' ? (
          <SideBySideView lines={parsedLines} fileName={fileName} />
        ) : (
          <UnifiedView lines={parsedLines} />
        )}
      </div>
    </div>
  );
}

function SideBySideView({ lines, fileName }: { lines: ParsedLine[]; fileName: string }) {
  // Build left/right column lines by walking through parsed lines
  // and tracking line numbers
  type ColLine = { content: string; type: ParsedLine['type']; lineNo: number };
  const leftLines: ColLine[] = [];
  const rightLines: ColLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.type === 'hunk-header') {
      // Parse line numbers from @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.content.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      continue;
    }

    if (line.type === 'removed') {
      leftLines.push({ content: line.content, type: 'removed', lineNo: oldLine++ });
      rightLines.push({ content: '', type: 'context', lineNo: 0 });
    } else if (line.type === 'added') {
      leftLines.push({ content: '', type: 'context', lineNo: 0 });
      rightLines.push({ content: line.content, type: 'added', lineNo: newLine++ });
    } else {
      leftLines.push({ content: line.content, type: 'context', lineNo: oldLine++ });
      rightLines.push({ content: line.content, type: 'context', lineNo: newLine++ });
    }
  }

  const maxLines = Math.max(leftLines.length, rightLines.length);

  return (
    <div className="flex min-w-full">
      {/* Left column */}
      <div className="flex-1 min-w-0 border-r border-border">
        <div className="sticky top-0 bg-bg-subtle border-b border-border px-3 py-1.5 text-[12px] text-text-secondary font-mono truncate z-10">
          {fileName}
        </div>
        <table className="w-full font-mono text-[13px] leading-[20px]">
          <tbody>
            {Array.from({ length: maxLines }, (_, i) => {
              const left = leftLines[i];
              const bgClass = left?.type === 'removed' ? 'bg-[#fef2f2]' : '';
              return (
                <tr key={`l-${i}`} className={bgClass}>
                  <td className="w-[1%] select-none text-right text-text-muted pr-2 pl-3 align-top text-[12px]">
                    {left?.lineNo ? left.lineNo : ''}
                  </td>
                  <td className="pr-4 whitespace-pre">
                    {left?.type === 'removed' ? (
                      <span className="text-test-fail">{left.content}</span>
                    ) : (
                      <span className="text-text-secondary">{left.content}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Right column */}
      <div className="flex-1 min-w-0">
        <div className="sticky top-0 bg-bg-subtle border-b border-border px-3 py-1.5 text-[12px] text-text-secondary font-mono truncate z-10">
          {fileName}
        </div>
        <table className="w-full font-mono text-[13px] leading-[20px]">
          <tbody>
            {Array.from({ length: maxLines }, (_, i) => {
              const right = rightLines[i];
              const bgClass = right?.type === 'added' ? 'bg-[#f0fdf4]' : '';
              return (
                <tr key={`r-${i}`} className={bgClass}>
                  <td className="w-[1%] select-none text-right text-text-muted pr-2 pl-3 align-top text-[12px]">
                    {right?.lineNo ? right.lineNo : ''}
                  </td>
                  <td className="pr-4 whitespace-pre">
                    {right?.type === 'added' ? (
                      <span className="text-test-pass">{right.content}</span>
                    ) : (
                      <span className="text-text-secondary">{right.content}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UnifiedView({ lines }: { lines: ParsedLine[] }) {
  let oldLine = 0;
  let newLine = 0;

  return (
    <table className="w-full font-mono text-[13px] leading-[20px]">
      <tbody>
        {lines.map((line, i) => {
          if (line.type === 'hunk-header') {
            const match = line.content.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
            if (match) {
              oldLine = parseInt(match[1], 10);
              newLine = parseInt(match[2], 10);
            }
            return (
              <tr key={i} className="bg-[#eff6ff]">
                <td className="w-[1%] select-none text-right text-text-muted pr-2 pl-4 align-top text-[12px]"></td>
                <td className="w-[1%] select-none text-right text-text-muted pr-2 align-top text-[12px]"></td>
                <td className="pr-4 whitespace-pre text-tool text-[12px]">
                  {line.content}
                </td>
              </tr>
            );
          }

          let bgClass = '';
          let textClass = '';
          let oldNo = '';
          let newNo = '';

          if (line.type === 'removed') {
            bgClass = 'bg-[#fef2f2]';
            textClass = 'text-text-secondary';
            oldNo = String(oldLine++);
          } else if (line.type === 'added') {
            bgClass = 'bg-[#f0fdf4]';
            textClass = 'text-text';
            newNo = String(newLine++);
          } else {
            textClass = 'text-text-muted';
            oldNo = String(oldLine++);
            newNo = String(newLine++);
          }

          return (
            <tr key={i} className={bgClass}>
              <td className="w-[1%] select-none text-right text-text-muted pr-2 pl-4 align-top text-[12px]">
                {oldNo}
              </td>
              <td className="w-[1%] select-none text-right text-text-muted pr-2 align-top text-[12px]">
                {newNo}
              </td>
              <td className={`pr-4 whitespace-pre ${textClass}`}>
                {line.content}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
