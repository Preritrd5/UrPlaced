export interface RateLimitConfig {
  maxRequestsPerWindow: number;
  windowSeconds: number;
  maxRequestsPerDay: number;
}

const DEFAULT_STUDENT_LIMITS: RateLimitConfig = {
  maxRequestsPerWindow: 20, // 20 requests per 10 minutes
  windowSeconds: 600,
  maxRequestsPerDay: 100,
};

const DEFAULT_STAFF_LIMITS: RateLimitConfig = {
  maxRequestsPerWindow: 50, // 50 requests per 10 minutes
  windowSeconds: 600,
  maxRequestsPerDay: 500,
};

interface RequestRecord {
  timestamps: number[];
  dayStart: number;
  dayCount: number;
}

// In-memory sliding tracker (persisted per runtime instance)
const rateLimitStore = new Map<string, RequestRecord>();

export class AIRateLimiter {
  /**
   * Checks whether the user is within rate limit boundaries.
   * Keyed by userId and feature or global AI usage.
   */
  public static checkLimit(
    userId: string,
    role: "STUDENT" | "PLACEMENT_HEAD" | "PLACEMENT_STAFF" | "TRAINER" | "SUPER_ADMIN" = "STUDENT"
  ): {
    allowed: boolean;
    remaining: number;
    resetInSeconds: number;
    reason?: string;
  } {
    const config = role === "STUDENT" ? DEFAULT_STUDENT_LIMITS : DEFAULT_STAFF_LIMITS;
    const now = Date.now();
    const windowStart = now - config.windowSeconds * 1000;
    const startOfDay = new Date().setHours(0, 0, 0, 0);

    let record = rateLimitStore.get(userId);
    if (!record) {
      record = {
        timestamps: [],
        dayStart: startOfDay,
        dayCount: 0,
      };
      rateLimitStore.set(userId, record);
    }

    // Reset daily counter if day turned over
    if (record.dayStart < startOfDay) {
      record.dayStart = startOfDay;
      record.dayCount = 0;
    }

    // Purge timestamps older than sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    // 1. Check daily limit
    if (record.dayCount >= config.maxRequestsPerDay) {
      const msUntilMidnight = new Date().setHours(24, 0, 0, 0) - now;
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.ceil(msUntilMidnight / 1000),
        reason: `Daily AI usage limit reached (${config.maxRequestsPerDay} requests/day). Limit resets at midnight.`,
      };
    }

    // 2. Check window limit
    if (record.timestamps.length >= config.maxRequestsPerWindow) {
      const oldestInWindow = record.timestamps[0];
      const resetInSeconds = Math.ceil((oldestInWindow + config.windowSeconds * 1000 - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.max(1, resetInSeconds),
        reason: `Short-term AI rate limit exceeded (${config.maxRequestsPerWindow} requests per 10 minutes). Please wait ${resetInSeconds}s.`,
      };
    }

    // Allow and increment
    record.timestamps.push(now);
    record.dayCount += 1;

    return {
      allowed: true,
      remaining: config.maxRequestsPerWindow - record.timestamps.length,
      resetInSeconds: config.windowSeconds,
    };
  }

  /**
   * Utility for tests to reset limits
   */
  public static resetForTest(userId?: string): void {
    if (userId) {
      rateLimitStore.delete(userId);
    } else {
      rateLimitStore.clear();
    }
  }
}
