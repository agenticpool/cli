import { Command } from 'commander';
import { ApiClient } from '../api';
import { configManager } from '../config';
import { AuthHelper } from '../auth/AuthHelper';
import { logger } from '../utils/logger';
import chalk from 'chalk';

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Authentication commands');

  auth
    .command('connect')
    .description('Connect to a network (auto-register if needed)')
    .argument('<networkId>', 'Network ID')
    .option('-k, --private-key <key>', 'Existing private key (optional)')
    .option('-r, --reason <text>', 'Reason for joining this network (for local records)')
    .action(async (networkId, options) => {
      try {
        logger.info(`Connecting to network: ${networkId}...`);
        const result = await AuthHelper.ensureAuthenticated(networkId, options.reason);
        
        if (result.isNewUser) {
          logger.success('✓ Registered and connected!');
        } else {
          logger.success('✓ Connected!');
        }

        // Record the network and reason locally
        await configManager.addRegisteredNetwork(networkId, options.reason);
        
        console.log(chalk.gray('Network:'), networkId);
        console.log(chalk.gray('Public Token:'), result.credentials.publicToken);
        if (options.reason) {
          console.log(chalk.gray('Reason:'), options.reason);
        }
        
        if (result.credentials.expiresAt) {
          const expires = new Date(result.credentials.expiresAt);
          console.log(chalk.gray('Token expires:'), expires.toISOString());
        }
      } catch (error) {
        logger.error('\nError:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  auth
    .command('disconnect')
    .description('Disconnect from a network')
    .argument('<networkId>', 'Network ID')
    .action(async (networkId) => {
      await configManager.clearCredentials(networkId);
      logger.success(`✓ Disconnected from network: ${networkId}`);
    });

  auth
    .command('generate-keys')
    .description('Generate a new public token and private key pair')
    .option('--force', 'Force generation of new keys even if they exist')
    .action(async (options) => {
      try {
        const existing = await configManager.getDefaultIdentity();
        if (existing && !options.force) {
          logger.warn('Default identity already exists. Use --force to overwrite.');
          console.log(chalk.cyan.bold('Public Token:'), chalk.white(existing.publicToken));
          return;
        }

        logger.info('Requesting new key pair from server...');
        const client = await AuthHelper.getApiClient();
        const response = await client.get<{ publicToken: string; privateKey: string }>('/v1/auth/generate-keys');

        if (response.success && response.data) {
          await configManager.saveDefaultIdentity({
            publicToken: response.data.publicToken,
            privateKey: response.data.privateKey
          });

          logger.success('✓ Keys generated and saved as default identity!\n');
          console.log(chalk.cyan.bold('Public Token:'), chalk.white(response.data.publicToken));
          console.log(chalk.cyan.bold('Private Key: '), chalk.yellow(response.data.privateKey));
          console.log(chalk.red('\n⚠️  CRITICAL: Save your private key now if you want to use it on other devices.'));
        } else {
          logger.error('Error:', response.error?.message || 'Failed to generate keys');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  auth
    .command('identity')
    .description('Show your current default identity (public token)')
    .action(async () => {
      const identity = await configManager.getDefaultIdentity();
      if (identity) {
        console.log(chalk.cyan.bold('Public Token:'), chalk.white(identity.publicToken));
      } else {
        logger.warn('No default identity found. Run "agenticpool auth generate-keys" first.');
      }
    });

  auth
    .command('register')
    .description('Register in a network')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-p, --public-token <token>', 'Your public token')
    .requiredOption('-k, --private-key <key>', 'Your private key')
    .option('-r, --reason <text>', 'Reason for registering')
    .action(async (options) => {
      try {
        logger.info(`Registering in ${options.network}...`);
        const client = await AuthHelper.getApiClient();
        const response = await client.post('/v1/auth/register', {
          networkId: options.network,
          publicToken: options.publicToken,
          privateKey: options.privateKey,
          reason: options.reason
        });

        if (response.success && response.data) {
          const data = response.data as { member: any; tokens: any };
          await configManager.saveCredentials(options.network, {
            publicToken: options.publicToken,
            privateKey: options.privateKey,
            jwt: data.tokens.jwt,
            expiresAt: data.tokens.expiresAt
          });
          await configManager.addRegisteredNetwork(options.network, options.reason);

          logger.success('✓ Registered successfully!');
          console.log(chalk.gray('Credentials saved locally.'));
        } else {
          logger.error('Error:', response.error?.message || 'Registration failed');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  auth
    .command('login')
    .description('Login to a network')
    .requiredOption('-n, --network <id>', 'Network ID')
    .requiredOption('-p, --public-token <token>', 'Your public token')
    .requiredOption('-k, --private-key <key>', 'Your private key')
    .option('-r, --reason <text>', 'Reason for login')
    .action(async (options) => {
      try {
        logger.info(`Logging in to ${options.network}...`);
        const client = await AuthHelper.getApiClient();
        const response = await client.post('/v1/auth/login', {
          networkId: options.network,
          publicToken: options.publicToken,
          privateKey: options.privateKey,
          reason: options.reason
        });

        if (response.success && response.data) {
          const tokens = response.data as any;
          await configManager.saveCredentials(options.network, {
            publicToken: options.publicToken,
            privateKey: options.privateKey,
            jwt: tokens.jwt,
            expiresAt: tokens.expiresAt
          });
          await configManager.addRegisteredNetwork(options.network, options.reason);

          logger.success('✓ Logged in successfully!');
          console.log(chalk.gray('New JWT session established.'));
        } else {
          logger.error('Error:', response.error?.message || 'Login failed');
        }
      } catch (error) {
        logger.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    });

  auth
    .command('logout')
    .description('Logout from a network')
    .requiredOption('-n, --network <id>', 'Network ID')
    .action(async (options) => {
      await configManager.clearCredentials(options.network);
      logger.success(`✓ Logged out from network: ${options.network}`);
    });

  auth
    .command('status')
    .description('Show authentication status')
    .option('-n, --network <id>', 'Network ID to check')
    .action(async (options) => {
      const config = await configManager.getGlobalConfig();
      console.log(chalk.cyan('API URL:'), config.apiUrl);
      console.log(chalk.cyan('Format:'), config.defaultFormat);
      console.log(chalk.cyan('Config dir:'), configManager.getConfigPath());
      
      if (options.network) {
        const creds = await configManager.getCredentials(options.network);
        if (creds) {
          console.log(chalk.cyan('\nNetwork:'), options.network);
          console.log(chalk.cyan('Public Token:'), creds.publicToken);
          if (creds.expiresAt) {
            const valid = Date.now() < creds.expiresAt;
            console.log(chalk.cyan('Token valid:'), valid ? chalk.green('Yes') : chalk.red('No (expired)'));
            console.log(chalk.cyan('Expires:'), new Date(creds.expiresAt).toISOString());
          }
        } else {
          logger.warn(`\nNot connected to network: ${options.network}`);
        }
      }
    });
}
