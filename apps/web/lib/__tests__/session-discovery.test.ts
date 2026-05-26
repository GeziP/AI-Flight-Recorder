import { describe, it, expect } from 'vitest';
import { extractSessionId, formatSessionDate } from '../session-discovery.js';

describe('extractSessionId', () => {
  it('extracts ID from timestamp_id format', () => {
    expect(extractSessionId('20260526_100112_abc123')).toBe('abc123');
  });
  it('returns full name when no underscore', () => {
    expect(extractSessionId('simple-name')).toBe('simple-name');
  });
});

describe('formatSessionDate', () => {
  it('formats timestamp prefix to readable date', () => {
    expect(formatSessionDate('20260526_100112_abc123')).toBe('May 26, 10:01');
  });
});
