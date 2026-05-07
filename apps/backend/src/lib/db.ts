import { PrismaClient, Prisma } from '@prisma/client'
import { logger } from './logger.js'

type LoggedClient = PrismaClient<Prisma.PrismaClientOptions, 'error' | 'warn'>

const globalForPrisma = globalThis as unknown as { prisma: LoggedClient | undefined }

export const db: LoggedClient =
  globalForPrisma.prisma ??
  new PrismaClient<Prisma.PrismaClientOptions, 'error' | 'warn'>({
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
