import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { ApiClient } from '../api/ApiClient';
import { configManager, NetworkCredentials } from '../config/ConfigManager';
import chalk from 'chalk';

export interface AuthResult {
  client: ApiClient;
  credentials: NetworkCredentials;
  isNewUser: boolean;
}

export class AuthHelper {
  static async ensureAuthenticated(networkId: string, reason?: string): Promise<AuthResult> {
    const config = await configManager.getGlobalConfig();
    const client = new ApiClient(config.apiUrl);
    client.setFormat(config.defaultFormat);

    const existingCreds = await configManager.getCredentials(networkId);
    
    if (existingCreds && existingCreds.jwt && existingCreds.expiresAt) {
      const bufferTime = 5 * 60 * 1000;
      if (Date.now() < (existingCreds.expiresAt - bufferTime)) {
        client.setAuthToken(existingCreds.jwt);
        // Even if token is valid, we might want to update the reason on the server
        // for tracking purposes if a reason was provided
        if (reason) {
          try {
            await client.post('/v1/auth/login', {
              networkId,
              publicToken: existingCreds.publicToken,
              privateKey: existingCreds.privateKey,
              reason
            });
          } catch (e) {
            // Ignore background reason update failures
          }
        }
        return { client, credentials: existingCreds, isNewUser: false };
      }
    }

    if (existingCreds && existingCreds.privateKey) {
      try {
        const response = await client.post<{ jwt: string; expiresAt: number; publicToken: string }>('/v1/auth/login', {
          networkId,
          publicToken: existingCreds.publicToken,
          privateKey: existingCreds.privateKey,
          reason
        });

        if (response.success && response.data) {
          const updatedCreds: NetworkCredentials = {
            ...existingCreds,
            jwt: response.data.jwt,
            expiresAt: response.data.expiresAt
          };
          
          await configManager.saveCredentials(networkId, updatedCreds);
          client.setAuthToken(response.data.jwt);
          
          return { client, credentials: updatedCreds, isNewUser: false };
        }
      } catch (error) {
        // Login failed, will try to register
      }
    }

    const keysResponse = await client.get<{ publicToken: string; privateKey: string }>('/v1/auth/generate-keys');
    
    if (!keysResponse.success || !keysResponse.data) {
      throw new Error('Failed to generate keys');
    }

    const keys = keysResponse.data;

    const registerResponse = await client.post<{ member: any; tokens: { jwt: string; expiresAt: number; publicToken: string } }>('/v1/auth/register', {
      networkId,
      publicToken: keys.publicToken,
      privateKey: keys.privateKey,
      reason
    });

    if (registerResponse.success && registerResponse.data) {
      const newCreds: NetworkCredentials = {
        publicToken: keys.publicToken,
        privateKey: keys.privateKey,
        jwt: registerResponse.data.tokens.jwt,
        expiresAt: registerResponse.data.tokens.expiresAt
      };

      await configManager.saveCredentials(networkId, newCreds);
      client.setAuthToken(registerResponse.data.tokens.jwt);

      console.log(chalk.green('✓ Auto-registered in network:'), networkId);
      console.log(chalk.gray('Public Token:'), keys.publicToken);

      return { client, credentials: newCreds, isNewUser: true };
    }

    throw new Error('Failed to authenticate');
  }

  static async getApiClient(): Promise<ApiClient> {
    const config = await configManager.getGlobalConfig();
    const client = new ApiClient(config.apiUrl);
    client.setFormat(config.defaultFormat);
    return client;
  }

  static async getAuthenticatedClient(networkId: string, reason?: string): Promise<ApiClient> {
    const result = await this.ensureAuthenticated(networkId, reason);
    return result.client;
  }

  static async getFirstAuthenticatedClient(): Promise<{ client: ApiClient; networkId: string }> {
    const credentialsDir = path.join(os.homedir(), '.agenticpool', 'credentials');
    
    if (!(await fs.pathExists(credentialsDir))) {
      throw new Error('No stored credentials found. Run "agenticpool auth connect <networkId>" first.');
    }

    const files = await fs.readdir(credentialsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const networkId = file.replace('.json', '');
      try {
        const result = await this.ensureAuthenticated(networkId);
        return { client: result.client, networkId };
      } catch {
        continue;
      }
    }

    throw new Error('No valid credentials found. Run "agenticpool auth connect <networkId>" first.');
  }
}
