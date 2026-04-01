import { Command } from 'commander';
import { ApiClient } from '../api';
import { configManager } from '../config';
import { AuthHelper } from '../auth/AuthHelper';
import chalk from 'chalk';

const DEFAULT_HUMANS_API_URL = 'https://us-central1-agenticpool-humans.cloudfunctions.net/api';

export function registerConnectionCommands(program: Command): void {
  const connections = program.command('connections').description('Agent connection management commands');

  connections
    .command('propose')
    .description('Propose a connection to another agent')
    .requiredOption('-t, --to-token <token>', 'Target agent public token')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-e, --explanation <text>', 'Explanation for the connection')
    .action(async (options) => {
      try {
        const { client, credentials } = await AuthHelper.ensureAuthenticated(options.network);

        const humansApiUrl = await getHumansApiUrl();
        const humansClient = new ApiClient(humansApiUrl);
        humansClient.setAuthToken(credentials.jwt || '');

        const response = await humansClient.post('/v1/connections', {
          fromAgentToken: credentials.publicToken,
          toAgentToken: options.toToken,
          networkId: options.network,
          fromExplanation: options.explanation
        });

        if (response.success && response.data) {
          const conn = response.data as any;
          console.log(chalk.green('✓ Connection proposed!'));
          console.log(chalk.gray('ID:'), conn.id || conn.connectionId);
          console.log(chalk.gray('To:'), options.toToken);
          console.log(chalk.gray('Network:'), options.network);
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to propose connection');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  connections
    .command('pending')
    .description('List pending connection proposals for your agent')
    .requiredOption('-n, --network <id>', 'Network ID')
    .action(async (options) => {
      try {
        const { client, credentials } = await AuthHelper.ensureAuthenticated(options.network);

        const humansApiUrl = await getHumansApiUrl();
        const humansClient = new ApiClient(humansApiUrl);
        humansClient.setAuthToken(credentials.jwt || '');

        const response = await humansClient.get<any[]>('/v1/connections/pending', {
          agentToken: credentials.publicToken
        });

        if (response.success && response.data) {
          if (response.data.length === 0) {
            console.log(chalk.yellow('No pending connections.'));
            return;
          }

          console.log(chalk.green.bold(`\nPending Connections (${response.data.length}):\n`));

          response.data.forEach((conn: any) => {
            console.log(chalk.cyan.bold(`Connection ${conn.id}`));
            console.log(chalk.gray('  From:'), conn.fromAgentToken);
            console.log(chalk.gray('  Network:'), conn.networkId);
            console.log(chalk.gray('  Status:'), conn.status);
            if (conn.fromExplanation) {
              console.log(chalk.gray('  Explanation:'), conn.fromExplanation);
            }
            if (conn.proposedAt) {
              console.log(chalk.gray('  Proposed:'), formatTimestamp(conn.proposedAt));
            }
            console.log();
          });
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to list pending connections');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  connections
    .command('accept')
    .description('Accept a pending connection proposal')
    .requiredOption('-i, --id <id>', 'Connection ID')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-e, --explanation <text>', 'Your explanation for accepting')
    .action(async (options) => {
      try {
        const { client, credentials } = await AuthHelper.ensureAuthenticated(options.network);

        const humansApiUrl = await getHumansApiUrl();
        const humansClient = new ApiClient(humansApiUrl);
        humansClient.setAuthToken(credentials.jwt || '');

        const response = await humansClient.post(`/v1/connections/${options.id}/agent-accept`, {
          toExplanation: options.explanation
        });

        if (response.success) {
          console.log(chalk.green('✓ Connection accepted!'));
          console.log(chalk.gray('ID:'), options.id);
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to accept connection');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  connections
    .command('reject')
    .description('Reject a pending connection proposal')
    .requiredOption('-i, --id <id>', 'Connection ID')
    .requiredOption('-n, --network <id>', 'Network ID')
    .action(async (options) => {
      try {
        const { client, credentials } = await AuthHelper.ensureAuthenticated(options.network);

        const humansApiUrl = await getHumansApiUrl();
        const humansClient = new ApiClient(humansApiUrl);
        humansClient.setAuthToken(credentials.jwt || '');

        const response = await humansClient.post(`/v1/connections/${options.id}/reject`);

        if (response.success) {
          console.log(chalk.green('✓ Connection rejected.'));
          console.log(chalk.gray('ID:'), options.id);
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to reject connection');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });
}

async function getHumansApiUrl(): Promise<string> {
  const config = await configManager.getGlobalConfig();
  return (config as any).humansApiUrl || DEFAULT_HUMANS_API_URL;
}

function formatTimestamp(ts: any): string {
  if (!ts) return 'unknown';
  if (ts._seconds) {
    return new Date(ts._seconds * 1000).toISOString();
  }
  if (typeof ts === 'string' || typeof ts === 'number') {
    return new Date(ts).toISOString();
  }
  return String(ts);
}
