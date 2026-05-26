import { Command } from 'commander';
import path from 'node:path';
import { Session, isGitRepo, detectShell, getTerminalSize, TerminalRecorder } from '@aifr/core';
import { success, info, warn, error, header } from '../lib/output.js';

const colors = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

export function startCommand(program: Command): Command {
  return program
    .command('start')
    .description('Start recording a new AI coding session')
    .option('--agent <type>', 'AI agent type (claude, codex, cursor, unknown)', 'unknown')
    .option('--dir <path>', 'Custom AIFR directory path')
    .action(async (options: { agent: string; dir?: string }) => {
      const cwd = process.cwd();

      // Validate agent type
      const validAgents = ['claude', 'codex', 'cursor', 'unknown'];
      if (!validAgents.includes(options.agent)) {
        error(`Invalid agent type: ${options.agent}. Must be one of: ${validAgents.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      header('AIFR Start');

      // Check git repo
      const isGit = await isGitRepo(cwd);
      if (!isGit) {
        warn('Current directory is not a Git repository.');
        info('Git diff capture will be limited.');
      } else {
        success('Git repository detected');
      }

      // Check/find AIFR directory
      let aifrDir: string;
      if (options.dir) {
        aifrDir = path.resolve(cwd, options.dir);
      } else {
        const existing = await Session.findAifrDir(cwd);
        if (existing) {
          aifrDir = existing;
          info(`Using existing AIFR directory: ${aifrDir}`);
        } else {
          // Auto-init if no .aifr exists
          aifrDir = path.join(cwd, '.aifr');
          info(`No AIFR directory found. Auto-initializing at ${aifrDir}`);
          const { Session: _ } = await import('@aifr/core');
          // We'll let Session.start() create the dirs
        }
      }

      // Create session
      const session = new Session({
        projectPath: cwd,
        agentType: options.agent as 'claude' | 'codex' | 'cursor' | 'unknown',
        aifrDir,
      });

      info(`Session ID: ${session.info.sessionId}`);

      try {
        // Start session (creates dirs, captures git baseline, writes start event)
        await session.start();
        success(`Session started at ${session.info.sessionDir}`);
        console.log('');
        info('Terminal recording active. Use your AI coding agent as normal.');
        info('Type "exit" or press Ctrl+D to end the session recording.');
        console.log('');

        // Start terminal recording
        const shell = detectShell();
        const { cols, rows } = getTerminalSize();

        const recorder = new TerminalRecorder({
          shell,
          cwd,
          cols,
          rows,
          logDir: session.info.sessionDir,
          session,
        });

        const exitCode = await recorder.run();

        // End session
        const status = exitCode === 0 ? 'completed' : exitCode === 130 ? 'aborted' : 'error';
        await session.end(status);

        console.log('');
        header('AIFR Session Complete');
        success(`Session ended (${status})`);
        info(`Session data: ${session.info.sessionDir}`);
        console.log('');
        info('Next steps:');
        console.log(`  ${colors.cyan('aifr replay')}    Replay this session`);
        console.log(`  ${colors.cyan('aifr diff')}     View code changes`);
        console.log(`  ${colors.cyan('aifr status')}   View session info`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Failed to start session: ${message}`);
        try {
          await session.end('error', message);
        } catch {
          // Ignore cleanup errors
        }
        process.exitCode = 1;
      }
    });
}
