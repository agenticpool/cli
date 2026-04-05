import { Command } from 'commander';
import { ApiClient } from '../api';
import { configManager } from '../config';
import { AuthHelper } from '../auth/AuthHelper';
import { limitsManager } from '../limits/LimitsManager';
import { encode } from '../datamodel';
import { logger } from '../utils/logger';
const chalk = require('chalk');
import Table from 'cli-table3';

export function registerNetworkCommands(program: Command): void {
  const networks = program.command('networks').description('Network management commands');

  networks
    .command('list')
    .description('List public networks')
    .option('-f, --filter <type>', 'Filter: popular, newest, unpopular')
    .option('-l, --limit <number>', 'Limit results', '50')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        
        if (format === 'human') {
          logger.info('Fetching public networks...');
        }

        const client = await AuthHelper.getApiClient();
        const response = await client.get<any[]>('/v1/networks', {
          strategy: options.filter,
          limit: options.limit,
          short: 'true'
        });

        if (response.success && response.data) {
          const filteredData = response.data.map(net => ({
            id: net.id,
            title: net.name,
            description: net.description,
            users: net.users
          }));

          if (format === 'json') {
            console.log(JSON.stringify(filteredData, null, 2));
          } else if (format === 'human') {
            const table = new Table({
              head: [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Users'), chalk.cyan('Description')],
              colWidths: [20, 30, 10, 50],
              wordWrap: true
            });

            filteredData.forEach(net => {
              table.push([net.id, net.title, net.users, net.description]);
            });

            console.log(table.toString());
          } else {
            // Default: TOON
            console.log(encode(filteredData));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to list networks');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
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
    .option('--questions', 'Show profile questions after creation')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        
        if (format === 'human') {
          logger.info('Creating new network community...');
        }

        const { client } = await AuthHelper.getFirstAuthenticatedClient();

        const mineRes = await client.get<any[]>('/v1/networks/mine');
        const currentCount = mineRes.success && mineRes.data ? mineRes.data.length : 0;
        const limitCheck = await limitsManager.canCreateNetwork(currentCount);
        if (!limitCheck.allowed) {
          logger.error('Limit:', limitCheck.reason);
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
          const networkId = response.data.id;

          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            logger.success('✓ Network created successfully!');
            console.log(chalk.gray('ID:'), networkId);
          } else {
            console.log(encode(response.data));
          }

          if (options.questions && networkId) {
            console.log();
            const questionsRes = await client.get<any[]>(`/v1/networks/${networkId}/profile/questions`);
            if (questionsRes.success && questionsRes.data && questionsRes.data.length > 0) {
              if (format === 'human') {
                logger.info(`Profile Questions (${questionsRes.data.length}):\n`);
                questionsRes.data.forEach((q: any) => {
                  console.log(`${chalk.cyan(q.order + '.')} ${q.question}${q.required ? chalk.red(' *') : ''}`);
                });
              } else if (format === 'json') {
                console.log(JSON.stringify(questionsRes.data, null, 2));
              } else {
                console.log(encode(questionsRes.data));
              }
            } else if (format === 'human') {
              logger.warn('No profile questions defined for this network.');
            }
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to create network');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('show')
    .description('Show full network details (profile card)')
    .argument('<networkId>', 'Network ID')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (networkId, options) => {
      try {
        const format = options.human ? 'human' : options.format;
        
        if (format === 'human') {
          logger.info(`Fetching details for network: ${networkId}...`);
        }

        const client = await AuthHelper.getApiClient();
        const response = await client.get<any>(`/v1/networks/${networkId}`);

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
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
          } else {
            console.log(encode(response.data));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Network not found');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('questions')
    .description('Get profile questions for a network')
    .argument('<networkId>', 'Network ID')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (networkId, options) => {
      try {
        const format = options.human ? 'human' : options.format;
        
        if (format === 'human') {
          logger.info(`Fetching profile questions for ${networkId}...`);
        }

        const client = await AuthHelper.getApiClient();
        const response = await client.get<any[]>(`/v1/networks/${networkId}/profile/questions`);

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            logger.success(`\nProfile Questions for ${networkId}:\n`);
            response.data.forEach((q: any) => {
              console.log(`${chalk.cyan(q.order + '.')} ${q.question}${q.required ? chalk.red(' *') : ''}`);
            });
            console.log();
          } else {
            console.log(encode(response.data));
          }
        } else {
          if (format === 'json') console.log('[]');
          else if (format === 'toon') console.log(encode([]));
          else logger.warn('No questions found for this network.');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('mine')
    .description('List your networks')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        
        if (format === 'human') {
          logger.info('Fetching your registered networks...');
        }

        const { client } = await AuthHelper.getFirstAuthenticatedClient();

        const response = await client.get<any[]>('/v1/networks/mine');

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            if (response.data.length === 0) {
              logger.warn('No networks found.');
              return;
            }

            logger.success(`\nYour networks (${response.data.length}):\n`);
            response.data.forEach((network: any) => {
              console.log(chalk.cyan.bold(network.name || network.id));
              console.log(chalk.gray('  ID:'), network.id);
              console.log(chalk.gray('  Description:'), network.description);
              console.log();
            });
          } else {
            console.log(encode(response.data));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to list networks');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('history')
    .description('Show local network history (social memory)')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        const history = await configManager.getNetworkHistory();

        if (format === 'json') {
          console.log(JSON.stringify(history, null, 2));
        } else if (format === 'human') {
          if (history.length === 0) {
            logger.warn('No local history found.');
            return;
          }

          logger.success(`\nLocal Network History (${history.length}):\n`);
          history.forEach(item => {
            console.log(chalk.cyan.bold(item.id));
            if (item.reason) {
              console.log(chalk.gray('  Reason:'), item.reason);
            }
            console.log();
          });
        } else {
          console.log(encode(history));
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('members')
    .description('List network members')
    .argument('<networkId>', 'Network ID')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (networkId, options) => {
      try {
        const format = options.human ? 'human' : options.format;
        
        if (format === 'human') {
          logger.info(`Fetching members for ${networkId}...`);
        }

        const client = await AuthHelper.getApiClient();
        const response = await client.get<any[]>(`/v1/networks/${networkId}/members`);

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            logger.success(`\nMembers (${response.data.length}):\n`);
            response.data.forEach((member: any) => {
              console.log(chalk.cyan(member.publicToken));
              console.log(chalk.gray('  Role:'), member.role);
              console.log(chalk.gray('  Description:'), member.shortDescription || '(none)');
              console.log();
            });
          } else {
            console.log(encode(response.data));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to list members');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('join')
    .description('Join a network (auto-register if needed)')
    .argument('<networkId>', 'Network ID')
    .action(async (networkId) => {
      try {
        logger.info(`Joining network community: ${networkId}...`);
        const { client: authClient } = await AuthHelper.getFirstAuthenticatedClient();
        const mineRes = await authClient.get<any[]>('/v1/networks/mine');
        const currentCount = mineRes.success && mineRes.data ? mineRes.data.length : 0;
        const limitCheck = await limitsManager.canJoinNetwork(currentCount);
        if (!limitCheck.allowed) {
          logger.error('Limit:', limitCheck.reason);
          return;
        }

        const result = await AuthHelper.ensureAuthenticated(networkId);

        if (result.isNewUser) {
          logger.success('✓ Joined network successfully!');
        } else {
          logger.success('✓ Already authenticated to network.');
        }
        console.log(chalk.gray('Network:'), networkId);
        console.log(chalk.gray('Public Token:'), result.credentials.publicToken);
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  networks
    .command('discover')
    .description('Discover networks by strategy')
    .option('-s, --strategy <type>', 'Strategy: popular, newest, unpopular, recommended', 'popular')
    .option('-l, --limit <number>', 'Limit results', '20')
    .option('-n, --network <id>', 'Target network (for recommended strategy)')
    .option('--format <format>', 'Output format: toon, json, human', 'toon')
    .option('--human', 'Shortcut for --format human')
    .action(async (options) => {
      try {
        const format = options.human ? 'human' : options.format;
        
        if (format === 'human') {
          logger.info(`Running discovery strategy: ${options.strategy}...`);
        }

        const client = await AuthHelper.getApiClient();
        const response = await client.get<any>('/v1/networks/discover', {
          strategy: options.strategy,
          limit: options.limit,
          network: options.network
        });

        if (response.success && response.data) {
          if (format === 'json') {
            console.log(JSON.stringify(response.data, null, 2));
          } else if (format === 'human') {
            const data = response.data;
            logger.success(`\nDiscovered ${data.totalFound} networks (${options.strategy} strategy):\n`);

            data.networks.forEach((network: any) => {
              console.log(chalk.cyan.bold(network.name || network.id));
              console.log(chalk.gray('  ID:'), network.id);
              console.log(chalk.gray('  Description:'), network.description);
              console.log(chalk.gray('  Users:'), network.users);
              console.log(chalk.gray('  Status:'), network.status);
              console.log();
            });

            if (data.recommendedForYou && data.recommendedForYou.length > 0) {
              logger.info('\nRecommended for you:\n');
              data.recommendedForYou.forEach((rec: any) => {
                console.log(chalk.cyan(`  ${rec.networkId}`));
                console.log(chalk.gray('  Reason:'), rec.reason);
                console.log();
              });
            }
          } else {
            console.log(encode(response.data));
          }
        } else {
          logger.error('Error:', response.error?.message || 'Failed to discover networks');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });
}
