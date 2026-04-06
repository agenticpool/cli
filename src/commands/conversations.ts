import { Command } from 'commander';
import { ApiClient } from '../api';
import { configManager } from '../config';
import { AuthHelper } from '../auth/AuthHelper';
import { encode } from '../datamodel';
import { logger } from '../utils/logger';
import chalk from '../utils/colors';
import Table from 'cli-table3';

export function registerConversationCommands(program: Command): void {
  const conversations = program.command('conversations').description('Conversation commands');

  conversations
    .command('list')
    .description('List conversations in a network')
    .requiredOption('-n, --network <id>', 'Network ID')
    .option('-s, --short', 'Show short format')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        const client = await AuthHelper.getApiClient();
        const response = await client.get<any[]>(`/v1/networks/${options.network}/conversations`, {
          short: options.short ? 'true' : undefined
        });

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            if (response.data.length === 0) {
              logger.warn('No conversations found.');
              return;
            }
            const table = new Table({
              head: [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Type'), chalk.cyan('Members')],
              colWidths: [20, 30, 15, 10]
            });
            response.data.forEach(conv => table.push([conv.id, conv.title, conv.type, conv.maxMembers]));
            console.log(table.toString());
          } else {
            console.log(encode(response.data));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to list conversations');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  conversations
    .command('mine')
    .description('List your conversations')
    .requiredOption('-n, --network <id>', 'Network ID')
    .option('-s, --short', 'Show short format')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        const { client } = await AuthHelper.ensureAuthenticated(options.network);

        const response = await client.get<any[]>('/v1/conversations/mine', {
          short: options.short ? 'true' : undefined
        });

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            if (response.data.length === 0) {
              logger.warn('You are not in any conversations.');
              return;
            }
            const table = new Table({
              head: [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Type')],
              colWidths: [20, 40, 15]
            });
            response.data.forEach(conv => table.push([conv.id, conv.title, conv.type]));
            console.log(table.toString());
          } else {
            console.log(encode(response.data));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to list conversations');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  conversations
    .command('create')
    .description('Create a new conversation')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-t, --title <title>', 'Conversation title')
    .option('--type <type>', 'Conversation type: topic, direct, group', 'group')
    .option('-m, --max-members <num>', 'Maximum members', '10')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        const { client } = await AuthHelper.ensureAuthenticated(options.network);

        const response = await client.post<any>(`/v1/networks/${options.network}/conversations`, {
          title: options.title,
          type: options.type,
          maxMembers: parseInt(options.maxMembers)
        });

        if (response.success && response.data) {
          const conv = response.data;
          const convId = conv.id || conv; // Handle string or object response

          if (format === 'json') {
            console.log(JSON.stringify(conv, null, 2));
          } else if (format === 'human') {
            logger.success('✓ Conversation created!');
            console.log(chalk.gray('ID:'), convId);
          } else {
            console.log(encode({ id: convId }));
          }

          // Auto-join the newly created conversation
          await client.post(`/v1/conversations/${options.network}/${convId}/join`);
        } else {
          logger.error('Error:', response.error?.message || 'Failed to create conversation');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  conversations
    .command('join')
    .description('Join a conversation')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-c, --conversation <id>', 'Conversation ID')
    .action(async (options) => {
      try {
        logger.info('Joining conversation...');
        const { client } = await AuthHelper.ensureAuthenticated(options.network);

        const response = await client.post(`/v1/conversations/${options.network}/${options.conversation}/join`);

        if (response.success) {
          logger.success('✓ Joined conversation!');
        } else {
          logger.error('Error:', response.error?.message || 'Failed to join conversation');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  conversations
    .command('explore')
    .description('Explore conversations with filters')
    .requiredOption('-n, --network <id>', 'Network ID')
    .option('-f, --filter <type>', 'Filter by type: topic, direct, group')
    .option('-t, --topic <keyword>', 'Search by keyword')
    .option('-s, --short', 'Show short format')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        const client = await AuthHelper.getApiClient();
        const params: any = { short: options.short ? 'true' : undefined };

        if (options.filter) params.filter = options.filter;
        if (options.topic) params.topic = options.topic;

        const response = await client.get<any[]>('/v1/networks/' + options.network + '/conversations', params);

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            if (response.data.length === 0) {
              logger.warn('No conversations found matching criteria.');
              return;
            }
            const table = new Table({
              head: [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Type')],
              colWidths: [20, 40, 15]
            });
            response.data.forEach(conv => table.push([conv.id, conv.title, conv.type]));
            console.log(table.toString());
          } else {
            console.log(encode(response.data));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to explore conversations');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  conversations
    .command('summary')
    .description('Get conversation insights and summary')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-c, --conversation <id>', 'Conversation ID')
    .option('-l, --limit <number>', 'Number of messages to analyze', '50')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        const client = await AuthHelper.getApiClient();
        const response = await client.get<any>('/v1/conversations/' + options.network + '/' + options.conversation + '/insights', {
          limit: options.limit
        });

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            const data = response.data;
            console.log(chalk.green.bold(`\nConversation: ${data.topic}\n`));
            console.log(chalk.cyan('  Messages:'), data.messageCount);
            console.log(chalk.cyan('  Participants:'), data.participants);
            console.log(chalk.cyan('  Tone:'), data.tone);
            console.log(chalk.cyan('  Top Keywords:'), data.keywords.join(', '));
            console.log();
            console.log(chalk.yellow.bold('Key Points:'));
            data.keywords.forEach((k: string) => console.log(chalk.gray('  -'), k));
          } else {
            console.log(encode(response.data));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to get conversation summary');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });
}
