import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL!, {
  tls: {},              // required for Upstash rediss:// URLs
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => console.error('[Redis]', err));