import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { LimitsManager, PlanLimits } from '../src/limits/LimitsManager';

jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  readJson: jest.fn(),
  ensureDir: jest.fn(),
}));

const mockedFs = fs as any;

describe('LimitsManager', () => {
  let manager: LimitsManager;

  beforeEach(() => {
    manager = new LimitsManager();
    jest.clearAllMocks();
    mockedFs.pathExists.mockResolvedValue(false);
    mockedFs.readJson.mockResolvedValue({});
  });

  describe('when limits.json does not exist', () => {
    beforeEach(() => {
      mockedFs.pathExists.mockResolvedValue(false);
    });

    test('getLimits returns null', async () => {
      expect(await manager.getLimits()).toBeNull();
    });

    test('canJoinNetwork always allowed', async () => {
      expect((await manager.canJoinNetwork(999)).allowed).toBe(true);
    });

    test('canCreateNetwork always allowed', async () => {
      expect((await manager.canCreateNetwork(999)).allowed).toBe(true);
    });

    test('hasSkill returns true when no limits loaded', () => {
      expect(manager.hasSkill('anything')).toBe(true);
    });
  });

  describe('starter plan', () => {
    const limits: PlanLimits = {
      plan: 'starter',
      maxNetworks: 1,
      skills: ['agneticpool-social', 'openclaw-free'],
      premiumLlms: false,
    };

    beforeEach(() => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue(limits);
    });

    test('reads plan correctly', async () => {
      const result = await manager.getLimits();
      expect(result!.plan).toBe('starter');
      expect(result!.maxNetworks).toBe(1);
      expect(result!.premiumLlms).toBe(false);
    });

    test('allows when under limit', async () => {
      expect((await manager.canJoinNetwork(0)).allowed).toBe(true);
    });

    test('blocks when at limit', async () => {
      const result = await manager.canJoinNetwork(1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('starter');
      expect(result.reason).toContain('1');
      expect(result.reason).toContain('shop.agneticpool.com');
    });

    test('hasSkill true for allowed', async () => {
      await manager.getLimits();
      expect(manager.hasSkill('agneticpool-social')).toBe(true);
    });

    test('hasSkill false for disallowed', async () => {
      await manager.getLimits();
      expect(manager.hasSkill('google-search')).toBe(false);
    });
  });

  describe('pro plan', () => {
    const limits: PlanLimits = {
      plan: 'pro',
      maxNetworks: 3,
      skills: ['agneticpool-social', 'openclaw-free', 'google-search', 'web-scraper', 'translation'],
      premiumLlms: false,
    };

    beforeEach(() => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue(limits);
    });

    test('allows up to 3 networks', async () => {
      expect((await manager.canJoinNetwork(0)).allowed).toBe(true);
      expect((await manager.canJoinNetwork(2)).allowed).toBe(true);
      expect((await manager.canJoinNetwork(3)).allowed).toBe(false);
    });

    test('has google-search skill', async () => {
      await manager.getLimits();
      expect(manager.hasSkill('google-search')).toBe(true);
    });
  });

  describe('elite plan', () => {
    const limits: PlanLimits = {
      plan: 'elite',
      maxNetworks: Infinity,
      skills: ['agneticpool-social', 'openclaw-free', 'google-search', 'web-scraper', 'translation', 'news-api', 'advanced-summarization'],
      premiumLlms: true,
    };

    beforeEach(() => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockResolvedValue(limits);
    });

    test('allows unlimited networks', async () => {
      expect((await manager.canJoinNetwork(100)).allowed).toBe(true);
      expect((await manager.canJoinNetwork(1000)).allowed).toBe(true);
    });

    test('has all skills', async () => {
      await manager.getLimits();
      expect(manager.hasSkill('news-api')).toBe(true);
      expect(manager.hasSkill('advanced-summarization')).toBe(true);
    });

    test('has premium LLMs', async () => {
      expect((await manager.getLimits())!.premiumLlms).toBe(true);
    });
  });

  describe('corrupt file', () => {
    beforeEach(() => {
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readJson.mockRejectedValue(new Error('bad json'));
    });

    test('getLimits returns null gracefully', async () => {
      expect(await manager.getLimits()).toBeNull();
    });

    test('canJoinNetwork allowed as fallback', async () => {
      expect((await manager.canJoinNetwork(999)).allowed).toBe(true);
    });
  });

  describe('caching', () => {
    test('clearCache forces re-read', async () => {
      mockedFs.pathExists.mockResolvedValue(false);
      await manager.getLimits();
      await manager.getLimits();
      const callsAfterCacheHit = mockedFs.pathExists.mock.calls.length;
      manager.clearCache();
      await manager.getLimits();
      expect(mockedFs.pathExists.mock.calls.length).toBeGreaterThan(callsAfterCacheHit);
    });
  });
});
