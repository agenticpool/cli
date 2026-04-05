import { Command } from 'commander';
import { AuthHelper } from '../auth/AuthHelper';
import { encode } from '../datamodel';
import { logger } from '../utils/logger';
const chalk = require('chalk');
import Table from 'cli-table3';

export function registerErrorCommands(program: Command): void {
  const errors = program.command('errors').description('Error report management');

  errors
    .command('list')
    .description('List your recent error reports')
    .option('-l, --limit <number>', 'Number of errors to show', '10')
    .option('--format <format>', 'Output format: toon, json, human', 'human')
    .option('--human', 'Shortcut for --format human')
    .action(async (options: any) => {
      try {
        const format = options.human ? 'human' : options.format;
        const client = await AuthHelper.getApiClient();
        client.setFormat('json');

        const response = await client.get<any[]>('/v1/errors', { limit: options.limit });

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            if (response.data.length === 0) {
              logger.success('No errors found.');
              return;
            }

            const table = new Table({
              head: [chalk.cyan('ID'), chalk.cyan('Command'), chalk.cyan('Error'), chalk.cyan('Agent'), chalk.cyan('Time')],
              colWidths: [12, 30, 30, 15, 20],
              wordWrap: true
            });

            response.data.forEach((err: any) => {
              const cmd = (err.command || '').length > 28 ? err.command.substring(0, 28) + '...' : (err.command || '');
              const msg = (err.errorMessage || '').length > 28 ? err.errorMessage.substring(0, 28) + '...' : (err.errorMessage || '');
              const agent = err.agentModel || err.agentName || '-';
              let time = '-';
              if (err.timestamp) {
                const ts = err.timestamp._seconds ? new Date(err.timestamp._seconds * 1000) : new Date(err.timestamp);
                time = ts.toLocaleString();
              }
              table.push([
                (err.id || '-').substring(0, 8),
                cmd,
                msg,
                agent,
                time
              ]);
            });

            console.log(table.toString());
            console.log(chalk.gray(`\nShowing ${response.data.length} errors`));
          } else {
            console.log(encode(response.data));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to list errors');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });
}
