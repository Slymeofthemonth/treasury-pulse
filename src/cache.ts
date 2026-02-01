// src/cache.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class TTLCache {
  private cache = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  getAge(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    return Math.floor((Date.now() - entry.timestamp) / 1000);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const cache = new TTLCache();

// Cache TTLs in milliseconds
export const TTL = {
  YIELDS: 4 * 60 * 60 * 1000,      // 4 hours
  FED_RATE: 24 * 60 * 60 * 1000,   // 24 hours
  BALANCE_SHEET: 24 * 60 * 60 * 1000, // 24 hours
  FOMC: 7 * 24 * 60 * 60 * 1000,   // 7 days
  CPI: 24 * 60 * 60 * 1000,        // 24 hours
};
