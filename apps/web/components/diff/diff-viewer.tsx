'use client';

import { useState, useMemo, Fragment, memo, useRef, useEffect, useCallback } from 'react';

interface DiffViewerProps {
  patch: string;
  fileName: string;
}

type ViewMode = 'side-by-side' | 'unified';

// ---- Lightweight syntax highlighter ----
type TokenType = 'keyword' | 'string' | 'comment' | 'number' | 'operator' | 'punctuation' | 'plain';

const TS_KEYWORDS = new Set([
  'import','export','from','default','as','const','let','var','function','return','if','else',
  'for','while','do','switch','case','break','continue','new','delete','typeof','instanceof',
  'class','extends','implements','interface','type','enum','namespace','module','declare',
  'public','private','protected','readonly','abstract','static','async','await','try','catch',
  'finally','throw','void','null','undefined','true','false','this','super','in','of','yield',
  'keyof','infer','never','unknown','any','asserts','require','satisfies',
]);

const CSS_KEYWORDS = new Set([
  '@import','@media','@keyframes','@font-face','@supports','@layer','@apply',
  '!important','from','to',
]);

const JSON_KEYWORDS = new Set(['true','false','null']);

function langFromFile(fileName: string): 'ts' | 'css' | 'json' | 'yaml' | 'plain' {
  if (/\.[jt]sx?$/.test(fileName) || /\.m[jt]s$/.test(fileName) || /\.cts$/.test(fileName)) return 'ts';
  if (/\.(css|scss|less)$/.test(fileName)) return 'css';
  if (fileName.endsWith('.json') || fileName.endsWith('.jsonc')) return 'json';
  if (/\.(ya?ml|toml)$/.test(fileName)) return 'yaml';
  return 'plain';
}

function tokenize(code: string, lang: string): { type: TokenType; text: string }[] {
  if (lang === 'plain') return [{ type: 'plain', text: code }];

  const tokens: { type: TokenType; text: string }[] = [];
  const keywords = lang === 'ts' ? TS_KEYWORDS : lang === 'json' ? JSON_KEYWORDS : CSS_KEYWORDS;
  let i = 0;

  while (i < code.length) {
    // Line comments
    if (code[i] === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i);
      tokens.push({ type: 'comment', text: end === -1 ? code.slice(i) : code.slice(i, end) });
      i = end === -1 ? code.length : end;
      continue;
    }
    // Block comments
    if (code[i] === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      const close = end === -1 ? code.length : end + 2;
      tokens.push({ type: 'comment', text: code.slice(i, close) });
      i = close;
      continue;
    }
    // Hash comments (YAML, shell)
    if (lang === 'yaml' && code[i] === '#') {
      const end = code.indexOf('\n', i);
      tokens.push({ type: 'comment', text: end === -1 ? code.slice(i) : code.slice(i, end) });
      i = end === -1 ? code.length : end;
      continue;
    }
    // Strings (double quote)
    if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') { if (code[j] === '\\') j++; j++; }
      tokens.push({ type: 'string', text: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Strings (single quote)
    if (code[i] === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== "'") { if (code[j] === '\\') j++; j++; }
      tokens.push({ type: 'string', text: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Template literals
    if (code[i] === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== '`') { if (code[j] === '\\') j++; j++; }
      tokens.push({ type: 'string', text: code.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Numbers
    if (/\d/.test(code[i]) && (i === 0 || !/\w/.test(code[i - 1]))) {
      let j = i;
      while (j < code.length && /[\d.xXa-fA-FeEbBoO_]/.test(code[j])) j++;
      tokens.push({ type: 'number', text: code.slice(i, j) });
      i = j;
      continue;
    }
    // Words (identifiers / keywords)
    if (/[a-zA-Z_$@]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\w$]/.test(code[j])) j++;
      // Check for @keyword in CSS
      const word = code.slice(i, j);
      if (keywords.has(word)) {
        tokens.push({ type: 'keyword', text: word });
      } else {
        tokens.push({ type: 'plain', text: word });
      }
      i = j;
      continue;
    }
    // Operators & punctuation
    if (/[<>+\-*/%=!&|^~?:]/.test(code[i])) {
      let j = i + 1;
      while (j < code.length && /[<>+\-*/%=!&|^~?:]/.test(code[j])) j++;
      tokens.push({ type: 'operator', text: code.slice(i, j) });
      i = j;
      continue;
    }
    if (/[{}()\[\];,.]/.test(code[i])) {
      tokens.push({ type: 'punctuation', text: code[i] });
      i++;
      continue;
    }
    // Whitespace & other
    tokens.push({ type: 'plain', text: code[i] });
    i++;
  }

  return tokens;
}

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: 'text-purple-700',
  string: 'text-amber-800',
  comment: 'text-gray-400 italic',
  number: 'text-blue-700',
  operator: 'text-gray-500',
  punctuation: 'text-gray-400',
  plain: '',
};

const HighlightedCode = memo(function HighlightedCode({ code, fileName }: { code: string; fileName: string }) {
  const lang = langFromFile(fileName);
  const tokens = useMemo(() => tokenize(code, lang), [code, lang]);

  if (!code) return null;

  return (
    <>
      {tokens.map((t, i) =>
        t.type === 'plain' || !TOKEN_COLORS[t.type] ? (
          <span key={i}>{t.text}</span>
        ) : (
          <span key={i} className={TOKEN_COLORS[t.type]}>{t.text}</span>
        )
      )}
    </>
  );
});

// ---- Patch parser ----

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
  const [highlight, setHighlight] = useState(false);

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
      {/* Toolbar */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-border shrink-0">
        <label className="flex items-center gap-1.5 text-[12px] text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={highlight}
            onChange={() => setHighlight(h => !h)}
            className="accent-blue-600"
          />
          Syntax highlight
        </label>
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
          <SideBySideView lines={parsedLines} fileName={fileName} highlight={highlight} />
        ) : (
          <UnifiedView lines={parsedLines} fileName={fileName} highlight={highlight} />
        )}
      </div>
    </div>
  );
}

const DIFF_PAGE = 80;

function useLazyPages(total: number) {
  const [count, setCount] = useState(DIFF_PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = count < total;

  useEffect(() => { setCount(DIFF_PAGE); }, [total]);

  useEffect(() => {
    if (!hasMore || !sentinel.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setCount((c) => c + DIFF_PAGE); },
      { rootMargin: '400px' },
    );
    obs.observe(sentinel.current);
    return () => obs.disconnect();
  }, [hasMore]);

  return { count, hasMore, sentinel };
}

function SideBySideView({ lines, fileName, highlight }: { lines: ParsedLine[]; fileName: string; highlight: boolean }) {
  // Build left/right column lines by walking through parsed lines
  // and tracking line numbers
  type ColLine = { content: string; type: ParsedLine['type']; lineNo: number };
  const leftLines: ColLine[] = [];
  const rightLines: ColLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.type === 'hunk-header') {
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
  const { count, hasMore, sentinel } = useLazyPages(maxLines);

  return (
    <div className="flex min-w-full">
      {/* Left column */}
      <div className="flex-1 min-w-0 border-r border-border">
        <div className="sticky top-0 bg-bg-subtle border-b border-border px-3 py-1.5 text-[12px] text-text-secondary font-mono truncate z-10">
          {fileName}
        </div>
        <table className="w-full font-mono text-[13px] leading-[20px]">
          <tbody>
            {Array.from({ length: Math.min(count, maxLines) }, (_, i) => {
              const left = leftLines[i];
              const bgClass = left?.type === 'removed' ? 'bg-[#fef2f2]' : '';
              return (
                <tr key={`l-${i}`} className={bgClass}>
                  <td className="w-[1%] select-none text-right text-text-muted pr-2 pl-3 align-top text-[12px]">
                    {left?.lineNo ? left.lineNo : ''}
                  </td>
                  <td className="pr-4 whitespace-pre">
                    {highlight
                      ? <HighlightedCode code={left?.content ?? ''} fileName={fileName} />
                      : left?.content}
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
            {Array.from({ length: Math.min(count, maxLines) }, (_, i) => {
              const right = rightLines[i];
              const bgClass = right?.type === 'added' ? 'bg-[#f0fdf4]' : '';
              return (
                <tr key={`r-${i}`} className={bgClass}>
                  <td className="w-[1%] select-none text-right text-text-muted pr-2 pl-3 align-top text-[12px]">
                    {right?.lineNo ? right.lineNo : ''}
                  </td>
                  <td className="pr-4 whitespace-pre">
                    {highlight
                      ? <HighlightedCode code={right?.content ?? ''} fileName={fileName} />
                      : right?.content}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMore && <div ref={sentinel} className="h-1" />}
    </div>
  );
}

function UnifiedView({ lines, fileName, highlight }: { lines: ParsedLine[]; fileName: string; highlight: boolean }) {
  const { count, hasMore, sentinel } = useLazyPages(lines.length);
  const visibleLines = lines.slice(0, count);
  let oldLine = 0;
  let newLine = 0;

  return (
    <>
      <table className="w-full font-mono text-[13px] leading-[20px]">
        <tbody>
          {visibleLines.map((line, i) => {
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
                  {highlight
                    ? <HighlightedCode code={line.content} fileName={fileName} />
                    : line.content}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasMore && <div ref={sentinel} className="h-1" />}
    </>
  );
}
