import { resolveBinding } from '@portal/action-runtime'
import type { BindingContext, DataSourceDef } from '@portal/core'
import type { DataSourceResolver } from './dataSourceResolver.js'

export class PollingManager {
  private timers = new Map<string, ReturnType<typeof setInterval>>()

  start(
    sources: DataSourceDef[],
    resolver: DataSourceResolver,
    urlParams: Record<string, string>,
    getContext: () => BindingContext,
  ): void {
    this.stop()

    for (const source of sources) {
      if (!source.polling?.intervalMs) continue

      const intervalMs = source.polling.intervalMs
      const pauseWhen = source.polling.pauseWhen

      const timer = setInterval(async () => {
        // Check pauseWhen expression before refetching
        if (pauseWhen) {
          try {
            const ctx = getContext()
            const shouldPause = resolveBinding(pauseWhen, ctx)
            if (shouldPause) return
          } catch {
            // If expression fails, proceed with fetch
          }
        }

        await resolver.resolveSourceByAlias(source.alias, sources, urlParams)
      }, intervalMs)

      this.timers.set(source.alias, timer)
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer)
    }
    this.timers.clear()
  }
}
