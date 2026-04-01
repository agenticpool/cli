import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { AuthTokens } from '@agenticpool/datamodel';

const CONFIG_DIR = path.join(os.homedir(), '.agenticpool');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CREDENTIALS_DIR = path.join(CONFIG_DIR, 'credentials');
const PROFILES_DIR = path.join(CONFIG_DIR, 'profiles');
const CACHE_DIR = path.join(CONFIG_DIR, 'cache');

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

export class ConfigManager {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    
    await fs.ensureDir(CONFIG_DIR);
    await fs.ensureDir(CREDENTIALS_DIR);
    await fs.ensureDir(PROFILES_DIR);
    await fs.ensureDir(CACHE_DIR);
    
    if (!(await fs.pathExists(CONFIG_FILE))) {
      await this.saveGlobalConfig({
        apiUrl: 'https://api.agenticpool.net',
        defaultFormat: 'toon'
      });
    }
    
    this.initialized = true;
  }

  async getGlobalConfig(): Promise<GlobalConfig> {
    await this.init();
    return fs.readJson(CONFIG_FILE);
  }

  async saveGlobalConfig(config: GlobalConfig): Promise<void> {
    await this.init();
    await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
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
    await fs.writeJson(credFile, credentials, { spaces: 2 });
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
