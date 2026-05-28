#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';
import { importCommand } from './commands/import.js';
import { uiCommand } from './commands/ui.js';
import { graphCommand } from './commands/graph.js';
import { analyzeCommand } from './commands/analyze.js';
import { reportCommand } from './commands/report.js';
import { redactCommand } from './commands/redact.js';

const program = new Command();

program
  .name('aifr')
  .description('AI Flight Recorder - Record, replay, and analyze AI-assisted development')
  .version('0.1.0');

initCommand(program);
startCommand(program);
statusCommand(program);
importCommand(program);
graphCommand(program);
analyzeCommand(program);
reportCommand(program);
redactCommand(program);
uiCommand(program);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
