import { Command } from 'commander';
import { ApiClient } from '../api';
import { configManager } from '../config';
const chalk = require('chalk');

const DEFAULT_HUMANS_API_URL = 'https://us-central1-agenticpool-humans.cloudfunctions.net/api';

export function registerHumansCommands(program: Command): void {
  const humans = program.command('humans').description('Human account management commands');

  humans
    .command('login')
    .description('Authenticate as a human (stores Firebase ID token)')
    .requiredOption('-t, --token <idToken>', 'Firebase ID token from humans-app login')
    .requiredOption('-u, --uid <uid>', 'Your human UID')
    .action(async (options) => {
      try {
        const config = await configManager.getGlobalConfig();
        const updated = { ...config, humanJwt: options.token, humanUid: options.uid, humanJwtExpiresAt: Date.now() + 3600 * 1000 };
        await configManager.saveGlobalConfig(updated);

        console.log(chalk.green('✓ Human credentials saved!'));
        console.log(chalk.gray('UID:'), options.uid);
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  humans
    .command('logout')
    .description('Remove stored human credentials')
    .action(async () => {
      try {
        const config = await configManager.getGlobalConfig();
        delete (config as any).humanJwt;
        delete (config as any).humanUid;
        delete (config as any).humanJwtExpiresAt;
        await configManager.saveGlobalConfig(config);

        console.log(chalk.green('✓ Human credentials removed.'));
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  humans
    .command('profile')
    .command('get')
    .description('Get your human profile')
    .action(async () => {
      try {
        const { client } = await getHumanAuthenticatedClient();

        const response = await client.get<any>('/v1/profile');

        if (response.success && response.data) {
          const profile = response.data;
          console.log(chalk.cyan.bold(`\n${profile.displayName || 'No display name'}\n`));
          console.log(chalk.gray('UID:'), profile.uid);
          if (profile.email) console.log(chalk.gray('Email:'), profile.email);
          if (profile.phone) console.log(chalk.gray('Phone:'), profile.phone);
          if (profile.telegram) console.log(chalk.gray('Telegram:'), profile.telegram);
          if (profile.photoUrl) console.log(chalk.gray('Photo:'), profile.photoUrl);
          if (profile.notes) console.log(chalk.gray('Notes:'), profile.notes);
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to get profile');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  humans
    .command('push-profiles')
    .description('Push locally stored agent profiles to humans API')
    .action(async () => {
      try {
        const { client, humanUid } = await getHumanAuthenticatedClient();
        const profiles = await configManager.getAllJSONProfiles();
        const networkIds = Object.keys(profiles);

        if (networkIds.length === 0) {
          console.log(chalk.yellow('No local JSON profiles found. Run "profile build" first.'));
          return;
        }

        console.log(chalk.cyan(`Pushing ${networkIds.length} profile(s) to humans API...\n`));

        const payload = {
          humanUid,
          profiles: networkIds.map(networkId => ({
            networkId,
            ...profiles[networkId]
          }))
        };

        const response = await client.post('/v1/profiles/push', payload);

        if (response.success) {
          console.log(chalk.green(`✓ Pushed ${networkIds.length} profile(s) successfully!`));
          networkIds.forEach(id => console.log(chalk.gray('  -'), id));
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to push profiles');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  humans
    .command('profile')
    .command('update')
    .description('Update your human profile')
    .option('--display-name <name>', 'Display name')
    .option('--phone <phone>', 'Phone number')
    .option('--email <email>', 'Email address')
    .option('--telegram <handle>', 'Telegram handle')
    .option('--photo-url <url>', 'Photo URL')
    .option('--notes <text>', 'Notes')
    .action(async (options) => {
      try {
        const { client } = await getHumanAuthenticatedClient();

        const body: any = {};
        if (options.displayName) body.displayName = options.displayName;
        if (options.phone) body.phone = options.phone;
        if (options.email) body.email = options.email;
        if (options.telegram) body.telegram = options.telegram;
        if (options.photoUrl) body.photoUrl = options.photoUrl;
        if (options.notes) body.notes = options.notes;

        const response = await client.put('/v1/profile', body);

        if (response.success) {
          console.log(chalk.green('✓ Profile updated!'));
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to update profile');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });
}

async function getHumanAuthenticatedClient(): Promise<{ client: ApiClient; humanUid: string }> {
  const config = await configManager.getGlobalConfig() as any;

  if (!config.humanJwt || !config.humanUid) {
    throw new Error('Not authenticated as a human. Run "agenticpool humans login" first.');
  }

  if (config.humanJwtExpiresAt && Date.now() > config.humanJwtExpiresAt) {
    throw new Error('Human session expired. Run "agenticpool humans login" again.');
  }

  const humansApiUrl = config.humansApiUrl || DEFAULT_HUMANS_API_URL;
  const client = new ApiClient(humansApiUrl);
  client.setAuthToken(config.humanJwt);

  return { client, humanUid: config.humanUid };
}
