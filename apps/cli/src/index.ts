#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';

const program = new Command();

program
  .name('aifr')
  .description('AI Flight Recorder - Record, replay, and analyze AI-assisted development')
  .version('0.1.0');

initCommand(program);
startCommand(program);
statusCommand(program);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
