import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isGitRepo } from '@aifr/core';
import { AIFR_EVENT_SCHEMA_VERSION } from '@aifr/event-schema';
import { success, info, warn, error, header } from '../lib/output.js';

const colors = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

export function initCommand(program: Command): Command {
  return program
    .command('init')
    .description('Initialize AIFR in the current project directory')
    .option('-d, --dir <path>', 'Custom directory path for .aifr', '.aifr')
    .action(async (options: { dir: string }) => {
      const cwd = process.cwd();
      const aifrDir = path.resolve(cwd, options.dir);

      header('AIFR Init');

      const isGit = await isGitRepo(cwd);
      if (!isGit) {
        warn('Current directory is not a Git repository.');
        info('Git diff capture will be limited. Run `git init` first for full functionality.');
      } else {
        success('Git repository detected');
      }

      if (existsSync(aifrDir)) {
        info(`AIFR directory already exists at ${aifrDir}`);
        info('Run `aifr start` to begin recording a session.');
        return;
      }

      try {
        await mkdir(aifrDir, { recursive: true });
        await mkdir(path.join(aifrDir, 'sessions'), { recursive: true });

        const gitignoreContent = `# AIFR Session Data
# Session recordings may contain sensitive code, tokens, and terminal output.
# Do NOT commit these files unless you have reviewed them for secrets.
sessions/
*.log
replay/
`;
        await writeFile(
          path.join(aifrDir, '.gitignore'),
          gitignoreContent,
          'utf8'
        );

        const configContent = {
          version: AIFR_EVENT_SCHEMA_VERSION,
          createdAt: new Date().toISOString(),
          projectPath: cwd,
          isGitRepo: isGit,
        };
        await writeFile(
          path.join(aifrDir, 'config.json'),
          JSON.stringify(configContent, null, 2),
          'utf8'
        );

        success(`Created ${aifrDir}`);
        info('Project initialized for AIFR recording');
        console.log('');
        info('Next steps:');
        console.log(`  ${colors.cyan('aifr start')}    Begin recording a new session`);
        console.log(`  ${colors.cyan('aifr status')}   Check recording status`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Failed to initialize AIFR: ${message}`);
        process.exitCode = 1;
      }
    });
}
