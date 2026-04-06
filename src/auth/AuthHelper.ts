import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { ApiClient } from '../api/ApiClient';
import { configManager, NetworkCredentials } from '../config/ConfigManager';
import chalk from '../utils/colors';

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
      console.log(chalk.gray(`  Attempting login for ${networkId}...`));
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

    // Try to use global identity if it exists
    const defaultIdentity = await configManager.getDefaultIdentity();
    let keys = defaultIdentity;

    if (!keys) {
      console.log(chalk.gray('  Generating new identity keys...'));
      const keysResponse = await client.get<{ publicToken: string; privateKey: string }>('/v1/auth/generate-keys');
      
      if (!keysResponse.success || !keysResponse.data) {
        throw new Error('Failed to generate keys');
      }

      keys = keysResponse.data;
      // Save as default for future use
      await configManager.saveDefaultIdentity(keys);
    }

    console.log(chalk.gray(`  Registering in network ${networkId}...`));

    const registerResponse = await client.post<any>('/v1/auth/register', {
      networkId,
      publicToken: keys.publicToken,
      privateKey: keys.privateKey,
      reason
    });

    if (registerResponse.success && registerResponse.data) {
      return this.handleAuthResponse(networkId, keys, registerResponse.data, client, true);
    }

    // Fallback: If already registered (or any 400-like error), try login instead
    const errorMessage = registerResponse.error?.message || '';
    const isAlreadyRegistered = errorMessage.toLowerCase().includes('already registered');
    
    if (isAlreadyRegistered || !registerResponse.success) {
      console.log(chalk.gray(`  Registration failed (likely already registered). Attempting login for ${networkId}...`));
      const loginResponse = await client.post<any>('/v1/auth/login', {
        networkId,
        publicToken: keys.publicToken,
        privateKey: keys.privateKey,
        reason
      });

      if (loginResponse.success && loginResponse.data) {
        return this.handleAuthResponse(networkId, keys, loginResponse.data, client, false);
      }
    }

    throw new Error(registerResponse.error?.message || 'Failed to authenticate');
  }

  private static async handleAuthResponse(
    networkId: string, 
    keys: { publicToken: string; privateKey: string }, 
    responseData: any, 
    client: ApiClient,
    isNewUser: boolean
  ): Promise<AuthResult> {
    const tokens = responseData.tokens || responseData;
    
    if (!tokens.jwt) {
      throw new Error('Authentication succeeded but no JWT found in response');
    }

    const newCreds: NetworkCredentials = {
      publicToken: keys.publicToken,
      privateKey: keys.privateKey,
      jwt: tokens.jwt,
      expiresAt: tokens.expiresAt
    };

    await configManager.saveCredentials(networkId, newCreds);
    client.setAuthToken(tokens.jwt);

    if (isNewUser) {
      console.log(chalk.green(`  ✓ Auto-registered in network: ${networkId}`));
    } else {
      console.log(chalk.green(`  ✓ Logged into network: ${networkId}`));
    }

    return { client, credentials: newCreds, isNewUser };
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
