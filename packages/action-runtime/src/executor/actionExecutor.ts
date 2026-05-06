import type { ActionDef, ExecuteContext, ExecuteResult } from './actionTypes.js'

export class ActionExecutor {
  constructor(private readonly context: ExecuteContext) {}

  async execute(action: ActionDef): Promise<ExecuteResult> {
    const start = Date.now()
    try {
      const data = await this.dispatch(action)
      return { success: true, data, durationMs: Date.now() - start }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      }
    }
  }

  private async dispatch(action: ActionDef): Promise<unknown> {
    switch (action.type) {
      case 'API_CALL':
        return this.executeApiCall(action)
      case 'TRIGGER_WEBHOOK':
        return this.executeTriggerWebhook(action)
      default:
        throw new Error(`Unhandled action type: ${action.type}`)
    }
  }

  private async executeApiCall(action: ActionDef): Promise<unknown> {
    const config = action.config as Record<string, unknown>
    const res = await fetch(`${this.context.backendUrl}/connector/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.context.accessToken}`,
        'x-correlation-id': this.context.correlationId,
      },
      body: JSON.stringify({
        appId: this.context.appId,
        pageId: this.context.pageId,
        ...config,
      }),
    })
    if (!res.ok) throw new Error(`API call failed: ${res.status}`)
    return res.json()
  }

  private async executeTriggerWebhook(action: ActionDef): Promise<void> {
    const config = action.config as { url: string; method?: string; body?: unknown }
    void fetch(config.url, {
      method: config.method ?? 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: config.body ? JSON.stringify(config.body) : undefined,
    })
  }
}
