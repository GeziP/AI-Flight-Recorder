import { eventSchema, type AIFREvent } from './schema.js';
import type { EventType } from './constants.js';

/**
 * Validate a raw JSON object against the event schema.
 */
export function validateEvent(
  raw: unknown
): { success: true; data: AIFREvent } | { success: false; error: string } {
  const result = eventSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues.map((e) => `[${e.path.join('.')}] ${e.message}`).join('; '),
  };
}

/**
 * Parse a JSONL line and validate.
 */
export function parseJSONLLine(
  line: string,
  lineNumber?: number
): { success: true; data: AIFREvent } | { success: false; error: string } {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return { success: false, error: 'empty or comment line' };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    const loc = lineNumber !== undefined ? `line ${lineNumber}` : 'unknown line';
    return { success: false, error: `Invalid JSON at ${loc}` };
  }
  return validateEvent(raw);
}

/**
 * Type guard: check if an event matches a specific type.
 */
export function isEventType<T extends EventType>(
  event: AIFREvent,
  eventType: T
): event is Extract<AIFREvent, { type: T }> {
  return event.type === eventType;
}

/**
 * Generate a ULID-like event ID.
 */
export function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}_${random}`;
}

/**
 * Generate a session ID from timestamp and random suffix.
 * Format: 20260526120011_abc123
 */
export function generateSessionId(): string {
  const now = new Date();
  const datePart = now.toISOString().replace(/[-:T]/g, '').substring(0, 15);
  const random = Math.random().toString(36).substring(2, 8);
  return `${datePart}_${random}`;
}
