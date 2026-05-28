'use client';

interface ReportClientProps {
  report: string | undefined;
}

export function ReportClient({ report }: ReportClientProps) {
  if (!report) {
    return (
      <div className="flex-1 p-8 text-text-muted">
        No report available. Run <code className="bg-card px-1.5 py-0.5 rounded text-xs">aifr report</code> to generate.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <article className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }} />
    </div>
  );
}

function renderMarkdown(md: string): string {
  let html = md;

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Code inline
  html = html.replace(/`([^`]+)`/g, '<code class="bg-card px-1 py-0.5 rounded text-xs">$1</code>');

  // Tables
  html = html.replace(/\n\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n)*)/g, (_match, header: string, body: string) => {
    const headers = header.split('|').map((c: string) => c.trim()).filter(Boolean);
    const rows = body.trim().split('\n').map(row =>
      row.split('|').map((c: string) => c.trim()).filter(Boolean)
    );
    let table = '<table class="w-full text-sm"><thead><tr>';
    for (const h of headers) table += `<th class="text-left p-2 border-b border-border">${h}</th>`;
    table += '</tr></thead><tbody>';
    for (const row of rows) {
      table += '<tr>';
      for (const cell of row) table += `<td class="p-2 border-b border-border">${cell}</td>`;
      table += '</tr>';
    }
    table += '</tbody></table>';
    return table;
  });

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul class="list-disc list-inside space-y-1">${match}</ul>`);

  // Paragraphs (lines that aren't tags)
  html = html.replace(/^(?!<[a-z/])(.+)$/gm, '<p>$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}
