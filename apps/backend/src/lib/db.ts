import { PrismaClient } from '@prisma/client'
import { logger } from './logger.js'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  })

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = db
}

db.$on('error', (e) => {
  logger.error({ err: e }, 'Prisma error')
})

db.$on('warn', (e) => {
  logger.warn({ msg: e.message }, 'Prisma warning')
})
