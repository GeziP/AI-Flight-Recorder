import { readFile } from 'node:fs/promises';
import type { AIFREvent } from '@aifr/event-schema';

export interface ParseError {
  line: number;
  content: string;
  error: string;
}

export interface ParseResult {
  events: AIFREvent[];
  errors: ParseError[];
}

export function parseJSONLContent(content: string): ParseResult {
  const events: AIFREvent[] = [];
  const errors: ParseError[] = [];

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    try {
      events.push(JSON.parse(line) as AIFREvent);
    } catch (err) {
      errors.push({
        line: i + 1,
        content: `[omitted — ${line.length} chars]`,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { events, errors };
}

export async function readEventsFile(filePath: string): Promise<ParseResult> {
  const content = await readFile(filePath, 'utf-8');
  return parseJSONLContent(content);
}
