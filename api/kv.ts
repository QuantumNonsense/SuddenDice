// Lightweight KV compatibility wrapper.
// Uses `@vercel/kv` when available (the default on Vercel with KV integration).
// If `process.env.REDIS_URL` is provided, falls back to a plain Redis client
// (node-redis) so you can point the app to an external Redis instance.

let vercelKv: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  vercelKv = require('@vercel/kv');
} catch (e) {
  vercelKv = null;
}

const useRedisFallback = typeof process.env.REDIS_URL === 'string' && process.env.REDIS_URL.length > 0;

let redisClient: any = null;
if (useRedisFallback) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { createClient } = require('redis');
    redisClient = createClient({ url: process.env.REDIS_URL });
    // connect but don't block startup
    redisClient.connect().catch(() => {});
  } catch (e) {
    // If redis package is not installed, fall through — callers will get errors.
    redisClient = null;
    // console.warn('Redis fallback requested but `redis` package not installed');
  }
}

const ensureJson = (v: any) => {
  if (v == null) return null;
  // Try to parse JSON strings created by this wrapper
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { /* not JSON */ }
    // if string is numeric, convert
    if (!Number.isNaN(Number(v))) return Number(v);
    return v;
  }
  return v;
};

export const kv = {
  async incr(key: string) {
    if (vercelKv && vercelKv.kv && !useRedisFallback) return vercelKv.kv.incr(key);
    if (redisClient) return redisClient.incr(key);
    throw new Error('No KV backend configured (set up Vercel KV or provide REDIS_URL)');
  },
  async get<T = any>(key: string): Promise<T | null> {
    if (vercelKv && vercelKv.kv && !useRedisFallback) return vercelKv.kv.get(key) as Promise<T | null>;
    if (redisClient) {
      const v = await redisClient.get(key);
      return ensureJson(v) as T | null;
    }
    throw new Error('No KV backend configured (set up Vercel KV or provide REDIS_URL)');
  },
  async set(key: string, value: unknown) {
    if (vercelKv && vercelKv.kv && !useRedisFallback) return vercelKv.kv.set(key, value);
    if (redisClient) {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      return redisClient.set(key, payload);
    }
    throw new Error('No KV backend configured (set up Vercel KV or provide REDIS_URL)');
  },
};

export default kv;
