import { Command } from 'commander';
import { ApiClient } from '../api';
import { configManager } from '../config';
import { AuthHelper } from '../auth/AuthHelper';
import chalk from 'chalk';

export function registerConversationCommands(program: Command): void {
  const conversations = program.command('conversations').description('Conversation commands');

  conversations
    .command('list')
    .description('List conversations in a network')
    .requiredOption('-n, --network <id>', 'Network ID')
    .option('-s, --short', 'Show short format')
    .action(async (options) => {
      try {
        const client = await AuthHelper.getApiClient();
        const response = await client.get<any[]>(`/v1/networks/${options.network}/conversations`, {
          short: options.short ? 'true' : undefined
        });

        if (response.success && response.data) {
          if (response.data.length === 0) {
            console.log(chalk.yellow('No conversations found.'));
            return;
          }

          console.log(chalk.green.bold(`\nConversations (${response.data.length}):\n`));
          
          response.data.forEach((conv: any) => {
            console.log(chalk.cyan.bold(conv.title));
            console.log(chalk.gray('  ID:'), conv.id);
            console.log(chalk.gray('  Type:'), conv.type);
            console.log(chalk.gray('  Max Members:'), conv.maxMembers);
            console.log();
          });
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to list conversations');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  conversations
    .command('mine')
    .description('List your conversations')
    .requiredOption('-n, --network <id>', 'Network ID')
    .option('-s, --short', 'Show short format')
    .action(async (options) => {
      try {
        const { client } = await AuthHelper.ensureAuthenticated(options.network);

        const response = await client.get<any[]>('/v1/conversations/mine', {
          short: options.short ? 'true' : undefined
        });

        if (response.success && response.data) {
          if (response.data.length === 0) {
            console.log(chalk.yellow('You are not in any conversations.'));
            return;
          }

          console.log(chalk.green.bold(`\nYour Conversations (${response.data.length}):\n`));
          
          response.data.forEach((conv: any) => {
            console.log(chalk.cyan.bold(conv.title));
            console.log(chalk.gray('  ID:'), conv.id);
            console.log(chalk.gray('  Type:'), conv.type);
            console.log();
          });
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to list conversations');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  conversations
    .command('create')
    .description('Create a new conversation')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-t, --title <title>', 'Conversation title')
    .option('--type <type>', 'Conversation type: topic, direct, group', 'group')
    .option('-m, --max-members <num>', 'Maximum members', '10')
    .action(async (options) => {
      try {
        const { client } = await AuthHelper.ensureAuthenticated(options.network);

        const response = await client.post(`/v1/networks/${options.network}/conversations`, {
          title: options.title,
          type: options.type,
          maxMembers: parseInt(options.maxMembers)
        });

        if (response.success && response.data) {
          const conv = response.data as any;
          console.log(chalk.green('✓ Conversation created!'));
          console.log(chalk.gray('ID:'), conv.id);
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to create conversation');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  conversations
    .command('join')
    .description('Join a conversation')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-c, --conversation <id>', 'Conversation ID')
    .action(async (options) => {
      try {
        const { client } = await AuthHelper.ensureAuthenticated(options.network);

        const response = await client.post(`/v1/conversations/${options.network}/${options.conversation}/join`);

        if (response.success) {
          console.log(chalk.green('✓ Joined conversation!'));
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to join conversation');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  conversations
    .command('explore')
    .description('Explore conversations with filters')
    .requiredOption('-n, --network <id>', 'Network ID')
    .option('-f, --filter <type>', 'Filter by type: topic, direct, group')
    .option('-t, --topic <keyword>', 'Search by keyword')
    .option('-s, --short', 'Show short format')
    .action(async (options) => {
      try {
        const client = await AuthHelper.getApiClient();
        const params: any = { short: options.short ? 'true' : undefined };

        if (options.filter) {
          params.filter = options.filter;
        }

        if (options.topic) {
          params.topic = options.topic;
        }

        const response = await client.get<any[]>('/v1/networks/' + options.network + '/conversations', params);

        if (response.success && response.data) {
          if (response.data.length === 0) {
            console.log(chalk.yellow('No conversations found matching your criteria.'));
            return;
          }

          console.log(chalk.green.bold(`\nFound ${response.data.length} conversations:\n`));

          response.data.forEach((conv: any) => {
            console.log(chalk.cyan.bold(conv.title));
            console.log(chalk.gray('  ID:'), conv.id);
            console.log(chalk.gray('  Type:'), conv.type);
            console.log(chalk.gray('  Max Members:'), conv.maxMembers);
            if (options.topic) {
              console.log(chalk.gray('  Filtered by topic:'), options.topic);
            }
            console.log();
          });
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to explore conversations');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  conversations
    .command('summary')
    .description('Get conversation insights and summary')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-c, --conversation <id>', 'Conversation ID')
    .option('-l, --limit <number>', 'Number of messages to analyze', '50')
    .action(async (options) => {
      try {
        const client = await AuthHelper.getApiClient();
        const response = await client.get<any>('/v1/conversations/' + options.network + '/' + options.conversation + '/insights', {
          limit: options.limit
        });

        if (response.success && response.data) {
          const data = response.data;
          console.log(chalk.green.bold(`\nConversation: ${data.topic}\n`));
          console.log(chalk.cyan('  Messages:'), data.messageCount);
          console.log(chalk.cyan('  Participants:'), data.participants);
          console.log(chalk.cyan('  Recent Activity:'), data.recentActivity);
          console.log(chalk.cyan('  Tone:'), data.tone);
          console.log(chalk.cyan('  Active Participants:'), data.activeParticipants.join(', '));
          console.log(chalk.cyan('  Top Keywords:'), data.keywords.join(', '));
          console.log();

          console.log(chalk.yellow.bold('Key Points:\n'));
          if (data.keywords.length > 0) {
            data.keywords.forEach((keyword: string) => {
              console.log(chalk.gray('  -'), keyword);
            });
          } else {
            console.log(chalk.gray('  No significant keywords found'));
          }
          console.log();
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to get conversation summary');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });
}
