import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  generateSessionId,
  generateEventId,
  AIFR_EVENT_SCHEMA_VERSION,
  type SessionStartEvent,
  type SessionEndEvent,
  type AIFREvent,
  type AgentType,
} from '@aifr/event-schema';
import { EventWriter } from './event-writer.js';
import { writeMetadata, type SessionMetadata } from './metadata.js';
import { captureGitBaseline } from './git.js';

export interface SessionOptions {
  projectPath: string;
  agentType: AgentType;
  aifrDir?: string;
}

export interface SessionInfo {
  sessionId: string;
  sessionDir: string;
  eventsPath: string;
  metadataPath: string;
}

export class Session {
  private sessionId: string;
  private sessionDir: string;
  private eventsPath: string;
  private metadataPath: string;
  private writer: EventWriter | null = null;
  private eventCount = 0;
  private startTime: number | null = null;

  constructor(
    private options: SessionOptions,
    sessionId?: string
  ) {
    this.sessionId = sessionId ?? generateSessionId();
    const aifrDir = options.aifrDir ?? path.join(options.projectPath, '.aifr');
    const sessionsDir = path.join(aifrDir, 'sessions');
    const timestamp = new Date().toISOString()
      .replace(/[-:T]/g, '')
      .substring(0, 15);
    const sessionName = `${timestamp}_${this.sessionId}`;
    this.sessionDir = path.join(sessionsDir, sessionName);
    this.eventsPath = path.join(this.sessionDir, 'events.jsonl');
    this.metadataPath = path.join(this.sessionDir, 'metadata.json');
  }

  get info(): SessionInfo {
    return {
      sessionId: this.sessionId,
      sessionDir: this.sessionDir,
      eventsPath: this.eventsPath,
      metadataPath: this.metadataPath,
    };
  }

  async start(): Promise<void> {
    await mkdir(this.sessionDir, { recursive: true });
    await mkdir(path.join(this.sessionDir, 'git'), { recursive: true });
    await mkdir(path.join(this.sessionDir, 'replay'), { recursive: true });

    this.startTime = Date.now();
    this.writer = new EventWriter(this.eventsPath);
    await this.writer.open();

    let gitRef = 'unknown';
    let gitBranch = 'unknown';
    try {
      const baseline = await captureGitBaseline(this.options.projectPath);
      gitRef = baseline.currentRef;
      gitBranch = baseline.currentBranch;
    } catch {
      // Git not available or not a git repo
    }

    const startEvent: SessionStartEvent = {
      id: generateEventId(),
      sessionId: this.sessionId,
      type: 'session',
      subtype: 'start',
      timestamp: Date.now(),
      schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
      projectPath: this.options.projectPath,
      agentType: this.options.agentType,
      gitRef,
      gitBranch,
      osPlatform: os.platform(),
      osRelease: os.release(),
      shell: this.detectShell(),
      aifrVersion: '0.1.0',
    };
    await this.appendEvent(startEvent);

    const metadata: SessionMetadata = {
      sessionId: this.sessionId,
      projectPath: this.options.projectPath,
      agentType: this.options.agentType,
      startTime: this.startTime,
      gitRef,
      gitBranch,
      status: 'recording',
    };
    await writeMetadata(this.metadataPath, metadata);
  }

  async appendEvent(event: AIFREvent): Promise<void> {
    if (!this.writer) {
      throw new Error('Session not started. Call start() first.');
    }
    await this.writer.append(event);
    this.eventCount++;
  }

  async end(status: 'completed' | 'aborted' | 'error' = 'completed', errorMessage?: string): Promise<void> {
    if (!this.writer || !this.startTime) {
      throw new Error('Session not started. Call start() first.');
    }

    const endEvent: SessionEndEvent = {
      id: generateEventId(),
      sessionId: this.sessionId,
      type: 'session',
      subtype: 'end',
      timestamp: Date.now(),
      schemaVersion: AIFR_EVENT_SCHEMA_VERSION,
      status,
      durationMs: Date.now() - this.startTime,
      eventCount: this.eventCount,
      gitRef: 'unknown',
      errorMessage,
    };
    await this.appendEvent(endEvent);

    await this.writer.close();
    this.writer = null;

    const metadata: SessionMetadata = {
      sessionId: this.sessionId,
      projectPath: this.options.projectPath,
      agentType: this.options.agentType,
      startTime: this.startTime,
      endTime: Date.now(),
      durationMs: Date.now() - this.startTime,
      gitRef: 'unknown',
      status: status === 'completed' ? 'completed' : status,
      eventCount: this.eventCount,
    };
    await writeMetadata(this.metadataPath, metadata);
  }

  static async findAifrDir(projectPath: string): Promise<string | null> {
    const aifrDir = path.join(projectPath, '.aifr');
    if (existsSync(aifrDir)) {
      return aifrDir;
    }
    return null;
  }

  private detectShell(): string {
    const shell = process.env.SHELL;
    if (shell) {
      return path.basename(shell);
    }
    if (process.platform === 'win32') {
      return process.env.PWSSHELL ? 'pwsh' : 'cmd';
    }
    return 'sh';
  }
}
