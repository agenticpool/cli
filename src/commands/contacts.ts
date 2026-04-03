import { Command } from 'commander';
import { ApiClient } from '../api';
import { configManager } from '../config';
import chalk from 'chalk';

const DEFAULT_HUMANS_API_URL = 'https://us-central1-agenticpool-humans.cloudfunctions.net/api';

export function registerContactCommands(program: Command): void {
  const contacts = program.command('contacts').description('Contact management commands');

  contacts
    .command('list')
    .description('List your contacts')
    .action(async () => {
      try {
        const { client } = await getHumanAuthenticatedClient();

        const response = await client.get<any[]>('/v1/contacts');

        if (response.success && response.data) {
          if (response.data.length === 0) {
            console.log(chalk.yellow('No contacts yet.'));
            return;
          }

          console.log(chalk.green.bold(`\nYour Contacts (${response.data.length}):\n`));

          response.data.forEach((contact: any) => {
            console.log(chalk.cyan.bold(contact.contactDisplayName || contact.contactUid));
            console.log(chalk.gray('  UID:'), contact.contactUid);
            if (contact.contactEmail) {
              console.log(chalk.gray('  Email:'), contact.contactEmail);
            }
            if (contact.contactPhone) {
              console.log(chalk.gray('  Phone:'), contact.contactPhone);
            }
            if (contact.contactTelegram) {
              console.log(chalk.gray('  Telegram:'), contact.contactTelegram);
            }

            if (contact.linkedIdentities && contact.linkedIdentities.length > 0) {
              console.log(chalk.gray('  Networks:'));
              contact.linkedIdentities.forEach((id: any) => {
                console.log(chalk.gray('    -'), `${id.networkId} (${id.publicToken})`);
                if (id.agentDescription) {
                  console.log(chalk.gray('      '), id.agentDescription);
                }
              });
            }

            console.log(chalk.gray('  Status:'), contact.status);
            console.log();
          });
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to list contacts');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  contacts
    .command('show')
    .description('Show full details of a contact')
    .requiredOption('-u, --uid <uid>', 'Contact user UID')
    .action(async (options) => {
      try {
        const { client } = await getHumanAuthenticatedClient();

        const response = await client.get<any>(`/v1/contacts/${options.uid}`);

        if (response.success && response.data) {
          const contact = response.data;
          console.log(chalk.cyan.bold(`\n${contact.contactDisplayName || contact.contactUid}\n`));
          console.log(chalk.gray('UID:'), contact.contactUid);

          if (contact.contactEmail) {
            console.log(chalk.gray('Email:'), contact.contactEmail);
          }
          if (contact.contactPhone) {
            console.log(chalk.gray('Phone:'), contact.contactPhone);
          }
          if (contact.contactTelegram) {
            console.log(chalk.gray('Telegram:'), contact.contactTelegram);
          }
          if (contact.contactPhotoUrl) {
            console.log(chalk.gray('Photo:'), contact.contactPhotoUrl);
          }

          if (contact.notes) {
            console.log(chalk.gray('\nNotes:'), contact.notes);
          }

          console.log(chalk.gray('Status:'), contact.status);

          if (contact.connectionId) {
            console.log(chalk.gray('Connection:'), contact.connectionId);
          }

          if (contact.linkedIdentities && contact.linkedIdentities.length > 0) {
            console.log(chalk.yellow.bold('\nLinked Identities:\n'));
            contact.linkedIdentities.forEach((id: any) => {
              console.log(chalk.cyan(`  ${id.networkId}`));
              console.log(chalk.gray('    Token:'), id.publicToken);
              if (id.agentDescription) {
                console.log(chalk.gray('    Description:'), id.agentDescription);
              }
              console.log();
            });
          }

          if (contact.createdAt) {
            console.log(chalk.gray('Added:'), formatTimestamp(contact.createdAt));
          }
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Contact not found');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  contacts
    .command('update')
    .description('Update contact notes')
    .requiredOption('-u, --uid <uid>', 'Contact user UID')
    .requiredOption('-n, --notes <text>', 'Notes about this contact')
    .action(async (options) => {
      try {
        const { client } = await getHumanAuthenticatedClient();

        const response = await client.put(`/v1/contacts/${options.uid}`, {
          notes: options.notes
        });

        if (response.success) {
          console.log(chalk.green('✓ Contact updated!'));
          console.log(chalk.gray('UID:'), options.uid);
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to update contact');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  contacts
    .command('block')
    .description('Block a contact (removes bidirectional contacts)')
    .requiredOption('-u, --uid <uid>', 'Contact user UID')
    .action(async (options) => {
      try {
        const { client } = await getHumanAuthenticatedClient();

        const response = await client.delete(`/v1/contacts/${options.uid}`);

        if (response.success) {
          console.log(chalk.green('✓ Contact blocked and removed.'));
          console.log(chalk.gray('UID:'), options.uid);
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to block contact');
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      }
    });

  contacts
    .command('link-identity')
    .description('Link a network identity to a contact')
    .requiredOption('-u, --uid <uid>', 'Contact user UID')
    .requiredOption('-i, --identity-id <id>', 'Identity ID to link')
    .action(async (options) => {
      try {
        const { client } = await getHumanAuthenticatedClient();

        const response = await client.post(`/v1/contacts/${options.uid}/link-identity`, {
          identityId: options.identityId
        });

        if (response.success) {
          console.log(chalk.green('✓ Identity linked to contact!'));
          console.log(chalk.gray('Contact UID:'), options.uid);
          console.log(chalk.gray('Identity ID:'), options.identityId);
        } else {
          console.error(chalk.red('Error:'), response.error?.message || 'Failed to link identity');
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
