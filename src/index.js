import { Command } from 'commander';
import chalk from 'chalk';
import { processTMXFile } from './tmx-processor.js';
import { TUPriorityManager } from './priority-manager.js';

const program = new Command();

program
  .name('tmx-duplicate-remover')
  .description('Remove duplicates from TMX files based on configurable priorities')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', 'Input TMX file path')
  .requiredOption('-o, --output <path>', 'Output TMX file path')
  .option('--creation-id <id>', 'Priority creation ID')
  .option('--change-id <id>', 'Priority change ID')
  .option('--change-date', 'Prioritize by change date')
  .option('--creation-date', 'Prioritize by creation date');

program.parse();

const options = program.opts();

try {
  const priorityManager = new TUPriorityManager({
    creationId: options.creationId,
    changeId: options.changeId,
    changeDate: options.changeDate,
    creationDate: options.creationDate
  });

  await processTMXFile(options.input, options.output, priorityManager);
  console.log(chalk.green('✔ Successfully processed TMX file'));
} catch (error) {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
}
