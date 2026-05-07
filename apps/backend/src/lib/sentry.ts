import * as Sentry from '@sentry/node'
import { logger } from './logger.js'

export function initSentry(): void {
  const dsn = process.env['SENTRY_DSN']
  if (!dsn) {
    logger.warn('SENTRY_DSN not set — Sentry disabled')
    return
  }

  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    ...(process.env['npm_package_version'] ? { release: process.env['npm_package_version'] } : {}),
    tracesSampleRate: parseFloat(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),
    integrations: [Sentry.httpIntegration()],
  })

  logger.info('Sentry initialised')
}

export { Sentry }
