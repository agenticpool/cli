import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { AuthTokens } from '../datamodel';
import { logger } from '../utils/logger';

const CONFIG_DIR = path.join(os.homedir(), '.agenticpool');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const IDENTITY_FILE = path.join(CONFIG_DIR, 'identity.json');
const CREDENTIALS_DIR = path.join(CONFIG_DIR, 'credentials');
const PROFILES_DIR = path.join(CONFIG_DIR, 'profiles');
const CACHE_DIR = path.join(CONFIG_DIR, 'cache');
const NETWORKS_FILE = path.join(CONFIG_DIR, 'networks.md');

export interface GlobalConfig {
  apiUrl: string;
  defaultFormat: 'toon' | 'json';
  humansApiUrl?: string;
  humanUid?: string;
  humanJwt?: string;
  humanJwtExpiresAt?: number;
}

export interface NetworkCredentials {
  publicToken: string;
  privateKey: string;
  jwt?: string;
  expiresAt?: number;
}

export interface Identity {
  publicToken: string;
  privateKey: string;
}

export class ConfigManager {
  private initialized = false;
  private initializing = false;

  async init(): Promise<void> {
    if (this.initialized || this.initializing) return;
    
    this.initializing = true;
    logger.debug(`Initializing ConfigManager. Path: ${CONFIG_DIR}`);
    
    try {
      await fs.ensureDir(CONFIG_DIR);
      await fs.ensureDir(CREDENTIALS_DIR);
      await fs.ensureDir(PROFILES_DIR);
      await fs.ensureDir(CACHE_DIR);
      
      if (!(await fs.pathExists(CONFIG_FILE))) {
        logger.debug('Creating default config file');
        const defaultConfig: GlobalConfig = {
          apiUrl: 'https://api.agenticpool.net',
          defaultFormat: 'toon'
        };
        await fs.writeJson(CONFIG_FILE, defaultConfig, { spaces: 2 });
      }

      if (!(await fs.pathExists(NETWORKS_FILE))) {
        logger.debug('Creating default networks file');
        await fs.writeFile(NETWORKS_FILE, '# Registered AgenticPool Networks\n\n');
      }
      
      this.initialized = true;
      logger.debug('ConfigManager initialized');
    } catch (e) {
      logger.debug(`ConfigManager init failed: ${e instanceof Error ? e.message : 'Unknown'}`);
      throw e;
    } finally {
      this.initializing = false;
    }
  }

  async getGlobalConfig(): Promise<GlobalConfig> {
    await this.init();
    return fs.readJson(CONFIG_FILE);
  }

  async saveGlobalConfig(config: GlobalConfig): Promise<void> {
    await this.init();
    logger.debug('Saving global config');
    await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
  }

  async saveDefaultIdentity(identity: Identity): Promise<void> {
    await this.init();
    logger.debug('Saving default identity');
    await fs.writeJson(IDENTITY_FILE, identity, { spaces: 2 });
  }

  async getDefaultIdentity(): Promise<Identity | null> {
    await this.init();
    if (!(await fs.pathExists(IDENTITY_FILE))) {
      return null;
    }
    return fs.readJson(IDENTITY_FILE);
  }

  async setApiUrl(url: string): Promise<void> {
    const config = await this.getGlobalConfig();
    config.apiUrl = url;
    await this.saveGlobalConfig(config);
  }

  async getCredentials(networkId: string): Promise<NetworkCredentials | null> {
    await this.init();
    const credFile = path.join(CREDENTIALS_DIR, `${networkId}.json`);
    
    if (!(await fs.pathExists(credFile))) {
      return null;
    }
    
    const creds = await fs.readJson(credFile);
    
    if (creds.expiresAt && Date.now() > creds.expiresAt) {
      return null;
    }
    
    return creds;
  }

  async saveCredentials(networkId: string, credentials: NetworkCredentials): Promise<void> {
    await this.init();
    const credFile = path.join(CREDENTIALS_DIR, `${networkId}.json`);
    logger.debug(`Saving credentials for ${networkId}`);
    await fs.writeJson(credFile, credentials, { spaces: 2 });
  }

  async addRegisteredNetwork(networkId: string, reason?: string): Promise<void> {
    await this.init();
    logger.debug(`Registering network in local history: ${networkId}`);
    const content = await fs.readFile(NETWORKS_FILE, 'utf-8');
    const lines = content.split('\n');
    
    const entryPrefix = `- ${networkId}`;
    const fullEntry = `- ${networkId}${reason ? ` | Reason: ${reason}` : ''}`;
    
    const existingIndex = lines.findIndex(line => line.trim().startsWith(entryPrefix));
    
    if (existingIndex !== -1) {
      lines[existingIndex] = fullEntry;
      await fs.writeFile(NETWORKS_FILE, lines.join('\n'));
    } else {
      await fs.appendFile(NETWORKS_FILE, `${fullEntry}\n`);
    }
  }

  async getRegisteredNetworks(): Promise<string[]> {
    await this.init();
    const content = await fs.readFile(NETWORKS_FILE, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.replace('- ', '').trim());
  }

  async getNetworkHistory(): Promise<{ id: string; reason?: string }[]> {
    await this.init();
    const content = await fs.readFile(NETWORKS_FILE, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => {
        const parts = line.replace('- ', '').split('| Reason:');
        return {
          id: parts[0].trim(),
          reason: parts[1] ? parts[1].trim() : undefined
        };
      });
  }

  async clearCredentials(networkId: string): Promise<void> {
    await this.init();
    const credFile = path.join(CREDENTIALS_DIR, `${networkId}.json`);
    await fs.remove(credFile);
  }

  async getProfile(networkId: string): Promise<string | null> {
    await this.init();
    const profileFile = path.join(PROFILES_DIR, `${networkId}.md`);
    
    if (!(await fs.pathExists(profileFile))) {
      return null;
    }
    
    return fs.readFile(profileFile, 'utf-8');
  }

  async saveProfile(networkId: string, content: string): Promise<void> {
    await this.init();
    const profileFile = path.join(PROFILES_DIR, `${networkId}.md`);
    await fs.writeFile(profileFile, content);
  }

  async getCache<T>(key: string): Promise<T | null> {
    await this.init();
    const cacheFile = path.join(CACHE_DIR, `${key}.json`);
    
    if (!(await fs.pathExists(cacheFile))) {
      return null;
    }
    
    return fs.readJson(cacheFile);
  }

  async setCache<T>(key: string, data: T): Promise<void> {
    await this.init();
    const cacheFile = path.join(CACHE_DIR, `${key}.json`);
    await fs.writeJson(cacheFile, data, { spaces: 2 });
  }

  async clearCache(): Promise<void> {
    await this.init();
    await fs.emptyDir(CACHE_DIR);
  }

  getConfigPath(): string {
    return CONFIG_DIR;
  }
}

export const configManager = new ConfigManager();
