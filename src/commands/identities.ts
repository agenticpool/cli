import { Command } from 'commander';
import { ApiClient } from '../api';
import { configManager } from '../config';
import { encode } from '@agenticpool/datamodel';
import chalk from 'chalk';

const DEFAULT_HUMANS_API_URL = 'https://us-central1-agenticpool-humans.cloudfunctions.net/api';

export function registerIdentityCommands(program: Command): void {
  const identities = program.command('identities').description('Identity management commands');

  identities
    .command('register')
    .description('Register a network identity for your human profile')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-p, --public-token <token>', 'Your agent public token on this network')
    .requiredOption('-d, --description <text>', 'Agent description for this identity')
    .option('--format <format>', 'Output format: toon, json, text', 'toon')
    .action(async (options) => {
      try {
        const { client, humanUid } = await getHumanAuthenticatedClient();
        client.setFormat(options.format === 'json' ? 'json' : 'toon');

        const response = await client.post<any>('/v1/identities', {
          humanUid,
          networkId: options.network,
          publicToken: options.publicToken,
          agentDescription: options.description
        });

        if (response.success && response.data) {
          if (options.format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (options.format === 'toon') {
            console.log(encode(response.data));
          } else {
            const identity = response.data;
            console.log(chalk.green('✓ Identity registered!'));
            console.log(chalk.gray('ID:'), identity.id);
            console.log(chalk.gray('Network:'), options.network);
            console.log(chalk.gray('Public Token:'), options.publicToken);
          }
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to register identity');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  identities
    .command('list')
    .description('List your registered identities')
    .option('--format <format>', 'Output format: toon, json, text', 'toon')
    .action(async (options) => {
      try {
        const { client, humanUid } = await getHumanAuthenticatedClient();
        client.setFormat(options.format === 'json' ? 'json' : 'toon');

        const response = await client.get<any[]>('/v1/identities');

        if (response.success && response.data) {
          if (options.format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (options.format === 'toon') {
            console.log(encode(response.data));
          } else {
            if (response.data.length === 0) {
              console.log(chalk.yellow('No identities registered.'));
              return;
            }

            console.log(chalk.green.bold(`\nYour Identities (${response.data.length}):\n`));

            response.data.forEach((identity: any) => {
              console.log(chalk.cyan.bold(identity.networkId));
              console.log(chalk.gray('  ID:'), identity.id);
              console.log(chalk.gray('  Public Token:'), identity.publicToken);
              console.log(chalk.gray('  Description:'), identity.agentDescription || '(none)');
              if (identity.addedAt) {
                console.log(chalk.gray('  Added:'), formatTimestamp(identity.addedAt));
              }
              console.log();
            });
          }
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to list identities');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  identities
    .command('remove')
    .description('Remove a registered identity')
    .requiredOption('-i, --id <id>', 'Identity ID')
    .action(async (options) => {
      try {
        const { client } = await getHumanAuthenticatedClient();

        const response = await client.delete(`/v1/identities/${options.id}`);

        if (response.success) {
          console.log(chalk.green('✓ Identity removed!'));
          console.log(chalk.gray('ID:'), options.id);
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to remove identity');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });
}

async function getHumanAuthenticatedClient(): Promise<{ client: ApiClient; humanUid: string }> {
  const config = await configManager.getGlobalConfig() as any;

  if (!config.humanJwt || !config.humanUid) {
    throw new Error('Not authenticated as a human. Please log in at humans.agenticpool.net first.');
  }

  if (config.humanJwtExpiresAt && Date.now() > config.humanJwtExpiresAt) {
    throw new Error('Human session expired. Please log in again at humans.agenticpool.net.');
  }

  const humansApiUrl = config.humansApiUrl || DEFAULT_HUMANS_API_URL;
  const client = new ApiClient(humansApiUrl);
  client.setAuthToken(config.humanJwt);

  return { client, humanUid: config.humanUid };
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
