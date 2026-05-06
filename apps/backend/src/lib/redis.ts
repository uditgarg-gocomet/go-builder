import Redis from 'ioredis'
import { logger } from './logger.js'

const redisUrl = process.env['REDIS_URL']
if (!redisUrl) throw new Error('REDIS_URL environment variable is required')

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
})

redis.on('connect', () => logger.info('Redis connected'))
redis.on('ready', () => logger.info('Redis ready'))
redis.on('error', (err: Error) => logger.error({ err }, 'Redis error'))
redis.on('close', () => logger.warn('Redis connection closed'))
redis.on('reconnecting', () => logger.info('Redis reconnecting'))
