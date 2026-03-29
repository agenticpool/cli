import { ConfigManager } from '../src/config/ConfigManager';

jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  pathExists: jest.fn().mockResolvedValue(true),
  readJson: jest.fn().mockResolvedValue({
    apiUrl: 'https://test.api.com',
    defaultFormat: 'toon'
  }),
  writeJson: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('# Profile'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  emptyDir: jest.fn().mockResolvedValue(undefined)
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  describe('getGlobalConfig', () => {
    it('should return global config', async () => {
      const config = await configManager.getGlobalConfig();
      
      expect(config).toEqual({
        apiUrl: 'https://test.api.com',
        defaultFormat: 'toon'
      });
    });
  });

  describe('getConfigPath', () => {
    it('should return config path', () => {
      const path = configManager.getConfigPath();
      expect(path).toContain('.agenticpool');
    });
  });
});
