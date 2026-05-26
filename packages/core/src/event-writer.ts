import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { AIFREvent } from '@aifr/event-schema';

/**
 * Handles appending events to a JSONL file.
 */
export class EventWriter {
  private stream: WriteStream | null = null;
  private filePath: string;
  private isOpen = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async open(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    this.stream = createWriteStream(this.filePath, {
      flags: 'a',
      encoding: 'utf8',
      autoClose: false,
    });
    this.isOpen = true;

    await new Promise<void>((resolve, reject) => {
      this.stream!.once('ready', resolve);
      this.stream!.once('error', reject);
    });
  }

  async append(event: AIFREvent): Promise<void> {
    if (!this.stream || !this.isOpen) {
      throw new Error('EventWriter not open. Call open() first.');
    }
    const line = JSON.stringify(event) + '\n';
    return new Promise<void>((resolve, reject) => {
      this.stream!.write(line, 'utf8', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (!this.stream || !this.isOpen) return;
    this.isOpen = false;
    return new Promise<void>((resolve, reject) => {
      this.stream!.end(() => {
        resolve();
      });
      this.stream!.once('error', reject);
    });
  }
}
