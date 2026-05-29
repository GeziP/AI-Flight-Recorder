#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';
import { importCommand } from './commands/import.js';
import { uiCommand } from './commands/ui.js';
import { graphCommand } from './commands/graph.js';
import { analyzeCommand } from './commands/analyze.js';
import { reportCommand } from './commands/report.js';
import { redactCommand } from './commands/redact.js';
import { replayCommand } from './commands/replay.js';
import { diffCommand } from './commands/diff.js';
import { exportCommand } from './commands/export.js';
import { searchCommand } from './commands/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();

program
  .name('aifr')
  .description('AI Flight Recorder - Record, replay, and analyze AI-assisted development')
  .version(pkg.version);

initCommand(program);
startCommand(program);
statusCommand(program);
importCommand(program);
graphCommand(program);
analyzeCommand(program);
reportCommand(program);
redactCommand(program);
replayCommand(program);
diffCommand(program);
exportCommand(program);
searchCommand(program);
uiCommand(program);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
