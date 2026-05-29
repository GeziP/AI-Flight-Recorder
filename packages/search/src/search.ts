import Database from 'better-sqlite3';
import { existsSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export interface SearchResult {
  sessionId: string;
  sessionDir: string;
  eventType: string;
  eventId: string;
  timestamp: number;
  snippet: string;
  rank: number;
}

export interface SearchOptions {
  limit?: number;
  session?: string;
  type?: string;
}

const DB_FILENAME = 'search.db';

export class SessionSearchIndex {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        session_dir TEXT NOT NULL,
        agent_type TEXT,
        imported_at TEXT,
        event_count INTEGER DEFAULT 0
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
        session_id,
        event_type,
        event_id,
        content,
        timestamp UNINDEXED,
        tokenize = 'unicode61'
      );
    `);
  }

  indexSession(sessionDir: string, sessionId?: string): number {
    const metadataPath = path.join(sessionDir, 'metadata.json');
    if (!existsSync(metadataPath)) return 0;

    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    const sid = sessionId ?? metadata.sessionId ?? path.basename(sessionDir);

    // Check if already indexed
    const existing = this.db.prepare('SELECT event_count FROM sessions WHERE session_id = ?').get(sid) as { event_count: number } | undefined;
    if (existing) {
      // Re-index: clear old data
      this.db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sid);
      this.db.prepare("DELETE FROM events_fts WHERE session_id = ?").run(sid);
    }

    const eventsPath = path.join(sessionDir, 'events.jsonl');
    if (!existsSync(eventsPath)) return 0;

    const raw = readFileSync(eventsPath, 'utf8');
    const lines = raw.split('\n').filter(l => l.trim());

    const insertEvent = this.db.prepare(`
      INSERT INTO events_fts (session_id, event_type, event_id, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    let indexed = 0;
    const insertMany = this.db.transaction(() => {
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          const content = extractSearchableContent(event);
          if (!content) continue;

          insertEvent.run(
            sid,
            event.type ?? 'unknown',
            event.id ?? '',
            content,
            event.timestamp ?? 0,
          );
          indexed++;
        } catch { /* skip malformed */ }
      }
    });

    insertMany();

    this.db.prepare(`
      INSERT INTO sessions (session_id, session_dir, agent_type, imported_at, event_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(sid, sessionDir, metadata.agentType ?? 'unknown', metadata.importedAt ?? new Date().toISOString(), indexed);

    return indexed;
  }

  indexAll(sessionsDir: string): { total: number; indexed: number } {
    if (!existsSync(sessionsDir)) return { total: 0, indexed: 0 };

    const dirs = readdirSync(sessionsDir).filter(d =>
      existsSync(path.join(sessionsDir, d, 'metadata.json')),
    );

    let totalIndexed = 0;
    for (const dir of dirs) {
      const sessionDir = path.join(sessionsDir, dir);
      totalIndexed += this.indexSession(sessionDir);
    }

    return { total: dirs.length, indexed: totalIndexed };
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const ftsQuery = escapeFtsQuery(query);
    const limit = options.limit ?? 100;
    let sql = `
      SELECT
        e.session_id,
        s.session_dir,
        e.event_type,
        e.event_id,
        e.timestamp,
        snippet(events_fts, 3, '<<', '>>', '...', 30) as snippet,
        rank
      FROM events_fts e
      JOIN sessions s ON e.session_id = s.session_id
      WHERE events_fts MATCH ?
    `;
    const params: unknown[] = [ftsQuery];

    if (options.session) {
      sql += ' AND e.session_id = ?';
      params.push(options.session);
    }

    if (options.type) {
      sql += ' AND e.event_type = ?';
      params.push(options.type);
    }

    sql += ' ORDER BY rank LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as Array<{
      session_id: string;
      session_dir: string;
      event_type: string;
      event_id: string;
      timestamp: number;
      snippet: string;
      rank: number;
    }>;

    return rows.map(row => ({
      sessionId: row.session_id,
      sessionDir: row.session_dir,
      eventType: row.event_type,
      eventId: row.event_id,
      timestamp: row.timestamp,
      snippet: row.snippet,
      rank: row.rank,
    }));
  }

  getSessionCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
    return row.count;
  }

  getEventCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM events_fts').get() as { count: number };
    return row.count;
  }

  close(): void {
    this.db.close();
  }
}

function extractSearchableContent(event: Record<string, unknown>): string | null {
  const type = event.type as string;
  switch (type) {
    case 'prompt':
      return [event.content, event.role].filter(Boolean).join(' ');
    case 'command': {
      const parts = [event.command];
      if (typeof event.stdout === 'string') parts.push(event.stdout);
      if (typeof event.stderr === 'string') parts.push(event.stderr);
      return parts.filter(Boolean).join(' ');
    }
    case 'diff': {
      const files = event.files as Array<Record<string, unknown>> | undefined;
      const filePaths = files?.map(f => f.path).join(' ') ?? '';
      const patch = typeof event.patch === 'string' ? event.patch : '';
      return [filePaths, patch].filter(Boolean).join(' ');
    }
    case 'tool': {
      const rawInput = typeof event.input === 'string' ? event.input : JSON.stringify(event.input ?? '');
      const input = rawInput.length > 2000 ? rawInput.substring(0, 2000) : rawInput;
      const output = typeof event.output === 'string' ? event.output : '';
      return [event.toolName, input, output].filter(Boolean).join(' ');
    }
    case 'test':
      return [event.name, event.outcome, event.output].filter(Boolean).join(' ');
    case 'terminal_output':
      return event.content as string | null;
    case 'retry':
      return [event.reason, event.originalCommand].filter(Boolean).join(' ');
    case 'session':
      return null;
    default:
      return JSON.stringify(event).substring(0, 1000);
  }
}

function escapeFtsQuery(query: string): string {
  // Remove special FTS5 characters and wrap in quotes for safety
  const cleaned = query.replace(/["'*:]/g, '').trim();
  if (!cleaned) return '""';
  // If query has multiple words, treat as implicit AND
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.map(w => `"${w}"`).join(' ');
}
