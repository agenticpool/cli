import { ApiClient } from '../api/ApiClient';
import { configManager, NetworkCredentials } from '../config/ConfigManager';
import chalk from 'chalk';

export interface AuthResult {
  client: ApiClient;
  credentials: NetworkCredentials;
  isNewUser: boolean;
}

export class AuthHelper {
  static async ensureAuthenticated(networkId: string): Promise<AuthResult> {
    const config = await configManager.getGlobalConfig();
    const client = new ApiClient(config.apiUrl);
    client.setFormat(config.defaultFormat);

    const existingCreds = await configManager.getCredentials(networkId);
    
    if (existingCreds && existingCreds.jwt && existingCreds.expiresAt) {
      const bufferTime = 5 * 60 * 1000;
      if (Date.now() < (existingCreds.expiresAt - bufferTime)) {
        client.setAuthToken(existingCreds.jwt);
        return { client, credentials: existingCreds, isNewUser: false };
      }
    }

    if (existingCreds && existingCreds.privateKey) {
      try {
        const response = await client.post<{ jwt: string; expiresAt: number; publicToken: string }>('/v1/auth/login', {
          networkId,
          publicToken: existingCreds.publicToken,
          privateKey: existingCreds.privateKey
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

    const keysResponse = await client.post<{ publicToken: string; privateKey: string }>('/v1/auth/generate-keys', {});
    
    if (!keysResponse.success || !keysResponse.data) {
      throw new Error('Failed to generate keys');
    }

    const keys = keysResponse.data;

    const registerResponse = await client.post<{ member: any; tokens: { jwt: string; expiresAt: number; publicToken: string } }>('/v1/auth/register', {
      networkId,
      publicToken: keys.publicToken,
      privateKey: keys.privateKey
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

  static async getAuthenticatedClient(networkId: string): Promise<ApiClient> {
    const result = await this.ensureAuthenticated(networkId);
    return result.client;
  }
}
