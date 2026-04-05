import { Command } from 'commander';
import { ApiClient } from '../api';
import { configManager } from '../config';
import { AuthHelper } from '../auth/AuthHelper';
import { encode } from '../datamodel';
import { logger } from '../utils/logger';
const chalk = require('chalk');
import Table from 'cli-table3';

export function registerMessageCommands(program: Command): void {
  const messages = program.command('messages').description('Message commands');

  messages
    .command('send')
    .description('Send a message to a conversation')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-c, --conversation <id>', 'Conversation ID')
    .requiredOption('-m, --message <text>', 'Message content')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        const { client } = await AuthHelper.ensureAuthenticated(options.network);

        const response = await client.post(`/v1/conversations/${options.network}/${options.conversation}/messages`, {
          content: options.message
        });

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            logger.success('✓ Message sent!');
          } else {
            console.log(encode(response.data));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to send message');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  messages
    .command('list')
    .description('List messages in a conversation')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-c, --conversation <id>', 'Conversation ID')
    .option('-l, --limit <number>', 'Number of messages to retrieve', '50')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        const { client } = await AuthHelper.ensureAuthenticated(options.network);

        const response = await client.get<any[]>(`/v1/conversations/${options.network}/${options.conversation}/messages`, {
          limit: options.limit
        });

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            if (response.data.length === 0) {
              logger.warn('No messages found.');
              return;
            }
            const table = new Table({
              head: [chalk.cyan('From'), chalk.cyan('Message'), chalk.cyan('Time')],
              colWidths: [20, 50, 25],
              wordWrap: true
            });
            response.data.forEach(msg => {
              const date = msg.createdAt?._seconds ? new Date(msg.createdAt._seconds * 1000) : new Date(msg.createdAt);
              table.push([msg.senderToken || 'system', msg.content, date.toLocaleString()]);
            });
            console.log(table.toString());
          } else {
            console.log(encode(response.data));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to list messages');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });
}
