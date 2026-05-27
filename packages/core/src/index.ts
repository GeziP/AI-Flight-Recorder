export { Session, type SessionOptions, type SessionInfo } from './session.js';
export { EventWriter } from './event-writer.js';
export { writeMetadata, readMetadata, type SessionMetadata } from './metadata.js';
export {
  captureGitBaseline,
  isGitRepo,
  findGitRoot,
  getFullDiff,
  getDiffStat,
  captureDiffToFile,
  type GitBaseline,
  type GitDiffResult,
  type FileChange,
} from './git.js';
export {
  TerminalRecorder,
  detectShell,
  getTerminalSize,
  type TerminalRecorderOptions,
} from './terminal-recorder.js';
