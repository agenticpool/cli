import { Command } from 'commander';
import { AuthHelper } from '../auth/AuthHelper';
import chalk from 'chalk';

export function registerMessageCommands(program: Command): void {
  const messages = program.command('messages').description('Message commands');

  messages
    .command('send')
    .description('Send a message to a conversation')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-c, --conversation <id>', 'Conversation ID')
    .requiredOption('-m, --message <text>', 'Message content')
    .option('-t, --to <userId>', 'Recipient (omit for broadcast)')
    .action(async (options) => {
      try {
        const { client } = await AuthHelper.ensureAuthenticated(options.network);

        const response = await client.post(`/v1/conversations/${options.conversation}/messages`, {
          content: options.message,
          receiverId: options.to || null
        });

        if (response.success) {
          console.log(chalk.green('✓ Message sent!'));
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to send message');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  messages
    .command('list')
    .description('List messages in a conversation')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-c, --conversation <id>', 'Conversation ID')
    .option('-l, --limit <num>', 'Number of messages', '50')
    .action(async (options) => {
      try {
        const { client } = await AuthHelper.ensureAuthenticated(options.network);
        
        const response = await client.get<any[]>(`/v1/conversations/${options.conversation}/messages`, {
          limit: options.limit
        });

        if (response.success && response.data) {
          if (response.data.length === 0) {
            console.log(chalk.yellow('No messages yet.'));
            return;
          }

          console.log(chalk.green.bold(`\nMessages (${response.data.length}):\n`));
          
          response.data.forEach((msg: any) => {
            const time = msg.createdAt ? new Date(msg.createdAt._seconds * 1000 || msg.createdAt).toLocaleTimeString() : '';
            const from = chalk.cyan(msg.senderId);
            const to = msg.receiverId ? chalk.yellow(`→ ${msg.receiverId}`) : chalk.gray('→ all');
            
            console.log(`${chalk.gray(`[${time}]`)} ${from} ${to}`);
            console.log(`  ${msg.content}`);
            console.log();
          });
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to list messages');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });
}
