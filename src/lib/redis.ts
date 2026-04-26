import Redis from "ioredis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL not set");
  _redis = new Redis(process.env.REDIS_URL, { lazyConnect: true });
  return _redis;
}
