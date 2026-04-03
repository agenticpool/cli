import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';

const CONFIG_DIR = path.join(os.homedir(), '.agenticpool');
const LIMITS_FILE = path.join(CONFIG_DIR, 'limits.json');

export interface PlanLimits {
  plan: 'starter' | 'pro' | 'elite';
  maxNetworks: number;
  skills: string[];
  premiumLlms: boolean;
  stripePriceId?: string;
  stripeCustomerId?: string;
}

const PLAN_DEFAULTS: Record<string, Partial<PlanLimits>> = {
  starter: { maxNetworks: 1, skills: ['agenticpool-social', 'openclaw-free'], premiumLlms: false },
  pro: { maxNetworks: 3, skills: ['agenticpool-social', 'openclaw-free', 'google-search', 'web-scraper', 'translation'], premiumLlms: false },
  elite: { maxNetworks: Infinity, skills: ['agenticpool-social', 'openclaw-free', 'google-search', 'web-scraper', 'translation', 'news-api', 'advanced-summarization'], premiumLlms: true },
};

export class LimitsManager {
  private cached: PlanLimits | null = null;

  async getLimits(): Promise<PlanLimits | null> {
    if (this.cached) return this.cached;

    const exists = await fs.pathExists(LIMITS_FILE);
    if (!exists) return null;

    try {
      const raw = await fs.readJson(LIMITS_FILE);
      this.cached = {
        plan: raw.plan || 'starter',
        maxNetworks: raw.maxNetworks ?? PLAN_DEFAULTS[raw.plan]?.maxNetworks ?? 1,
        skills: raw.skills || PLAN_DEFAULTS[raw.plan]?.skills || [],
        premiumLlms: raw.premiumLlms ?? PLAN_DEFAULTS[raw.plan]?.premiumLlms ?? false,
        stripePriceId: raw.stripePriceId,
        stripeCustomerId: raw.stripeCustomerId,
      };
      return this.cached;
    } catch {
      return null;
    }
  }

  async canJoinNetwork(currentNetworkCount: number): Promise<{ allowed: boolean; reason?: string }> {
    const limits = await this.getLimits();
    if (!limits) return { allowed: true };

    if (currentNetworkCount >= limits.maxNetworks) {
      return {
        allowed: false,
        reason: `Limit reached: Your ${limits.plan} plan allows a maximum of ${limits.maxNetworks} network(s). Upgrade at shop.agenticpool.com`,
      };
    }

    return { allowed: true };
  }

  async canCreateNetwork(currentNetworkCount: number): Promise<{ allowed: boolean; reason?: string }> {
    return this.canJoinNetwork(currentNetworkCount);
  }

  hasSkill(skill: string): boolean {
    if (!this.cached) return true;
    return this.cached.skills.includes(skill);
  }

  clearCache(): void {
    this.cached = null;
  }
}

export const limitsManager = new LimitsManager();
