import { Command } from 'commander';
import { ApiClient } from '../api';
import { configManager } from '../config';
import { AuthHelper } from '../auth/AuthHelper';
import { encode } from '../datamodel';
import { logger } from '../utils/logger';
import chalk from '../utils/colors';
import Table from 'cli-table3';

export function registerMessageCommands(program: Command): void {
  const messages = program.command('messages').description('Message commands');

  messages
    .command('send')
    .description('Send a message to a conversation')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-c, --conversation <id>', 'Conversation ID')
    .requiredOption('-m, --message <text>', 'Message content')
    .option('-r, --reply-to <id>', 'Message ID to reply to')
    .option('--context <count>', 'Fetch recent messages before sending for context', '0')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        const { client } = await AuthHelper.ensureAuthenticated(options.network);

        const contextCount = parseInt(options.context, 10);
        if (contextCount > 0) {
          const contextRes = await client.get<any[]>(
            `/v1/conversations/${options.network}/${options.conversation}/messages`,
            { limit: String(contextCount) }
          );

          if (contextRes.success && contextRes.data && contextRes.data.length > 0) {
            if (format === 'human') {
              console.log(chalk.cyan.bold(`\n--- Recent Context (${contextRes.data.length} messages) ---\n`));
              contextRes.data.forEach((msg: any) => {
                const sender = msg.senderId || 'system';
                const preview = msg.content.length > 120 ? msg.content.slice(0, 120) + '...' : msg.content;
                console.log(chalk.gray(`[${sender}]`), preview);
              });
              console.log(chalk.cyan.bold('\n--- Sending ---\n'));
            } else if (format === 'json') {
              console.log(JSON.stringify({ context: contextRes.data }, null, 2));
            } else {
              console.log(encode({ context: contextRes.data }));
            }
          }
        }

        const response = await client.post(`/v1/conversations/${options.network}/${options.conversation}/messages`, {
          content: options.message,
          replyTo: options.replyTo
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
              head: [chalk.cyan('ID'), chalk.cyan('From'), chalk.cyan('Reply To'), chalk.cyan('Message'), chalk.cyan('Time')],
              colWidths: [20, 20, 20, 40, 25],
              wordWrap: true
            });
            response.data.forEach(msg => {
              let dateStr = 'Invalid Date';
              if (msg.createdAt) {
                if (msg.createdAt._seconds) {
                  dateStr = new Date(msg.createdAt._seconds * 1000).toLocaleString();
                } else if (typeof msg.createdAt === 'string') {
                  if (msg.createdAt.startsWith('_seconds:')) {
                    dateStr = new Date(parseInt(msg.createdAt.split(':')[1]) * 1000).toLocaleString();
                  } else {
                    dateStr = new Date(msg.createdAt).toLocaleString();
                  }
                }
              }
              table.push([msg.id, msg.senderId || 'system', msg.replyTo || '-', msg.content, dateStr]);
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

  messages
    .command('delete')
    .description('Delete a message (only if you are the sender)')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-c, --conversation <id>', 'Conversation ID')
    .requiredOption('-m, --message <id>', 'Message ID')
    .action(async (options) => {
      try {
        const { client } = await AuthHelper.ensureAuthenticated(options.network);

        const response = await client.delete(`/v1/conversations/${options.network}/${options.conversation}/messages/${options.message}`);

        if (response.success) {
          logger.success('✓ Message deleted!');
        } else {
          logger.error('Error:', response.error?.message || 'Failed to delete message');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  messages
    .command('inbox')
    .description('View messages received across all your pools')
    .option('-l, --limit <number>', 'Number of messages to retrieve', '20')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        const { client } = await AuthHelper.getFirstAuthenticatedClient();

        const response = await client.get<any[]>('/v1/conversations/inbox', {
          limit: options.limit
        });

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            if (response.data.length === 0) {
              logger.warn('Your inbox is empty.');
              return;
            }
            logger.info(`\nInbox (${response.data.length} messages):\n`);
            const table = new Table({
              head: [chalk.cyan('Pool'), chalk.cyan('Conv'), chalk.cyan('From'), chalk.cyan('Message'), chalk.cyan('Time')],
              colWidths: [15, 15, 20, 40, 25],
              wordWrap: true
            });
            response.data.forEach(msg => {
              let dateStr = 'Invalid Date';
              if (msg.createdAt) {
                if (msg.createdAt._seconds) {
                  dateStr = new Date(msg.createdAt._seconds * 1000).toLocaleString();
                } else if (typeof msg.createdAt === 'string') {
                  if (msg.createdAt.startsWith('_seconds:')) {
                    dateStr = new Date(parseInt(msg.createdAt.split(':')[1]) * 1000).toLocaleString();
                  } else {
                    dateStr = new Date(msg.createdAt).toLocaleString();
                  }
                }
              }
              // Try to find pool/conv from the message path if available or specific fields
              const pool = msg.networkId || '-';
              const conv = msg.conversationId || '-';
              table.push([pool, conv, msg.senderId || 'system', msg.content, dateStr]);
            });
            console.log(table.toString());
          } else {
            console.log(encode(response.data));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to get inbox');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });
}
