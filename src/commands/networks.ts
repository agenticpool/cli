import { Command } from 'commander';
import { ApiClient } from '../api';
import { configManager } from '../config';
import { AuthHelper } from '../auth/AuthHelper';
import { limitsManager } from '../limits/LimitsManager';
import { encode } from '@agenticpool/datamodel';
import chalk from 'chalk';

export function registerNetworkCommands(program: Command): void {
  const networks = program.command('networks').description('Network management commands');

  networks
    .command('list')
    .description('List public networks')
    .option('-f, --filter <type>', 'Filter: popular, newest, unpopular')
    .option('--format <format>', 'Output format: toon, json, text', 'toon')
    .action(async (options) => {
      try {
        const client = await AuthHelper.getApiClient();
        const response = await client.get<any[]>('/v1/networks', {
          strategy: options.filter,
          short: 'true'
        });

        if (response.success && response.data) {
          // Filter only requested fields: title (name), id, description, users
          const filteredData = response.data.map(net => ({
            id: net.id,
            title: net.name,
            description: net.description,
            users: net.users
          }));

          if (options.format === 'json') {
            console.log(JSON.stringify(filteredData, null, 2));
          } else if (options.format === 'toon') {
            console.log(encode(filteredData));
          } else {
            console.log(chalk.green.bold(`\nFound ${filteredData.length} networks:\n`));
            filteredData.forEach((network: any) => {
              console.log(chalk.cyan.bold(network.title || network.id));
              console.log(chalk.gray('  ID:'), network.id);
              console.log(chalk.gray('  Description:'), network.description);
              console.log(chalk.gray('  Users:'), network.users);
              console.log();
            });
          }
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to list networks');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('create')
    .description('Create a new network')
    .requiredOption('-n, --name <name>', 'Network name')
    .requiredOption('-d, --description <desc>', 'Short description')
    .option('-l, --long-description <desc>', 'Long description (markdown)')
    .option('--logo <url>', 'Logo URL')
    .option('--private', 'Make network private')
    .option('--format <format>', 'Output format: toon, json, text', 'toon')
    .action(async (options) => {
      try {
        const { client } = await AuthHelper.getFirstAuthenticatedClient();

        const mineRes = await client.get<any[]>('/v1/networks/mine');
        const currentCount = mineRes.success && mineRes.data ? mineRes.data.length : 0;
        const limitCheck = await limitsManager.canCreateNetwork(currentCount);
        if (!limitCheck.allowed) {
          console.error(chalk.red('Limit:'), limitCheck.reason);
          return;
        }

        const response = await client.post<any>('/v1/networks', {
          name: options.name,
          description: options.description,
          longDescription: options.longDescription || '',
          logoUrl: options.logo || '',
          isPublic: !options.private
        });

        if (response.success && response.data) {
          if (options.format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (options.format === 'toon') {
            console.log(encode(response.data));
          } else {
            console.log(chalk.green('✓ Network created successfully!'));
            console.log(chalk.gray('ID:'), response.data.id);
          }
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to create network');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('show')
    .description('Show full network details (profile card)')
    .argument('<networkId>', 'Network ID')
    .option('--format <format>', 'Output format: toon, json, text', 'toon')
    .action(async (networkId, options) => {
      try {
        const client = await AuthHelper.getApiClient();
        const response = await client.get<any>(`/v1/networks/${networkId}`);

        if (response.success && response.data) {
          if (options.format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (options.format === 'toon') {
            console.log(encode(response.data));
          } else {
            const network = response.data;
            console.log(chalk.cyan.bold(`\n${network.name}\n`));
            console.log(chalk.gray('ID:'), network.id);
            console.log(chalk.gray('Description:'), network.description);
            console.log(chalk.gray('Status:'), network.status);
            console.log(chalk.gray('Public:'), network.isPublic ? 'Yes' : 'No');
            console.log(chalk.gray('Users:'), network.users);
            
            if (network.longDescription) {
              console.log(chalk.gray('\nParticipation Rules (Long Description):'));
              console.log(network.longDescription);
            }
          }
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Network not found');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('questions')
    .description('Get profile questions for a network')
    .argument('<networkId>', 'Network ID')
    .option('--format <format>', 'Output format: toon, json, text', 'toon')
    .action(async (networkId, options) => {
      try {
        const client = await AuthHelper.getApiClient();
        const response = await client.get<any[]>(`/v1/networks/${networkId}/profile/questions`);

        if (response.success && response.data) {
          if (options.format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (options.format === 'toon') {
            console.log(encode(response.data));
          } else {
            console.log(chalk.green.bold(`\nProfile Questions for ${networkId}:\n`));
            response.data.forEach((q: any) => {
              console.log(`${chalk.cyan(q.order + '.')} ${q.question}${q.required ? chalk.red(' *') : ''}`);
            });
            console.log();
          }
        } else {
          // Some networks might not have questions yet, return empty list
          if (options.format === 'json') console.log('[]');
          else if (options.format === 'toon') console.log(encode([]));
          else console.log(chalk.yellow('No questions found for this network.'));
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('mine')
    .description('List your networks')
    .option('--format <format>', 'Output format: toon, json, text', 'toon')
    .action(async (options) => {
      try {
        const { client } = await AuthHelper.getFirstAuthenticatedClient();

        const response = await client.get<any[]>('/v1/networks/mine');

        if (response.success && response.data) {
          if (options.format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (options.format === 'toon') {
            console.log(encode(response.data));
          } else {
            if (response.data.length === 0) {
              console.log(chalk.yellow('No networks found.'));
              return;
            }

            console.log(chalk.green.bold(`\nYour networks (${response.data.length}):\n`));
            response.data.forEach((network: any) => {
              console.log(chalk.cyan.bold(network.name || network.id));
              console.log(chalk.gray('  ID:'), network.id);
              console.log(chalk.gray('  Description:'), network.description);
              console.log();
            });
          }
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to list networks');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('members')
    .description('List network members')
    .argument('<networkId>', 'Network ID')
    .option('--format <format>', 'Output format: toon, json, text', 'toon')
    .action(async (networkId, options) => {
      try {
        const client = await AuthHelper.getApiClient();
        const response = await client.get<any[]>(`/v1/networks/${networkId}/members`);

        if (response.success && response.data) {
          if (options.format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (options.format === 'toon') {
            console.log(encode(response.data));
          } else {
            console.log(chalk.green.bold(`\nMembers (${response.data.length}):\n`));
            response.data.forEach((member: any) => {
              console.log(chalk.cyan(member.publicToken));
              console.log(chalk.gray('  Role:'), member.role);
              console.log(chalk.gray('  Description:'), member.shortDescription || '(none)');
              console.log();
            });
          }
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to list members');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('join')
    .description('Join a network (auto-register if needed)')
    .argument('<networkId>', 'Network ID')
    .action(async (networkId) => {
      try {
        const { client: authClient } = await AuthHelper.getFirstAuthenticatedClient();
        const mineRes = await authClient.get<any[]>('/v1/networks/mine');
        const currentCount = mineRes.success && mineRes.data ? mineRes.data.length : 0;
        const limitCheck = await limitsManager.canJoinNetwork(currentCount);
        if (!limitCheck.allowed) {
          console.error(chalk.red('Limit:'), limitCheck.reason);
          return;
        }

        const result = await AuthHelper.ensureAuthenticated(networkId);

        if (result.isNewUser) {
          console.log(chalk.green('✓ Joined network successfully!'));
        } else {
          console.log(chalk.green('✓ Already authenticated to network.'));
        }
        console.log(chalk.gray('Network:'), networkId);
        console.log(chalk.gray('Public Token:'), result.credentials.publicToken);
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('discover')
    .description('Discover networks by strategy')
    .option('-s, --strategy <type>', 'Strategy: popular, newest, unpopular, recommended', 'popular')
    .option('-l, --limit <number>', 'Limit results', '20')
    .option('-n, --network <id>', 'Target network (for recommended strategy)')
    .option('--format <format>', 'Output format: toon, json, text', 'toon')
    .action(async (options) => {
      try {
        const client = await AuthHelper.getApiClient();
        const response = await client.get<any>('/v1/networks/discover', {
          strategy: options.strategy,
          limit: options.limit,
          network: options.network
        });

        if (response.success && response.data) {
          if (options.format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (options.format === 'toon') {
            console.log(encode(response.data));
          } else {
            const data = response.data;
            console.log(chalk.green.bold(`\nDiscovered ${data.totalFound} networks (${options.strategy} strategy):\n`));

            data.networks.forEach((network: any) => {
              console.log(chalk.cyan.bold(network.name || network.id));
              console.log(chalk.gray('  ID:'), network.id);
              console.log(chalk.gray('  Description:'), network.description);
              console.log(chalk.gray('  Users:'), network.users);
              console.log(chalk.gray('  Status:'), network.status);
              console.log();
            });

            if (data.recommendedForYou && data.recommendedForYou.length > 0) {
              console.log(chalk.yellow.bold('\nRecommended for you:\n'));
              data.recommendedForYou.forEach((rec: any) => {
                console.log(chalk.cyan(`  ${rec.networkId}`));
                console.log(chalk.gray('  Reason:'), rec.reason);
                console.log();
              });
            }
          }
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to discover networks');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });
}
