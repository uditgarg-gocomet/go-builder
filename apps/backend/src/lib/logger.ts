import pino from 'pino'

const isDev = process.env['NODE_ENV'] !== 'production'

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
  base: {
    service: 'core-backend',
    version: process.env['npm_package_version'] ?? 'unknown',
    env: process.env['NODE_ENV'] ?? 'development',
  },
})

export function createChildLogger(module: string, extra?: Record<string, unknown>): pino.Logger {
  return logger.child({ module, ...extra })
}
