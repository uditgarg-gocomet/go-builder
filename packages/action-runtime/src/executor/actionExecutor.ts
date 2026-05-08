import type { ActionDef, BindingContext } from '@portal/core'
import { interpolate } from '../binding/bindingResolver.js'
import type { StateManager } from '../state/stateManager.js'
import type { FormManager } from '../forms/formManager.js'
import type { ConfirmManager, DataResolver, ExecuteContext, ExecuteResult, ModalManager, RouterAdapter, ToastManager } from './actionTypes.js'

function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export interface ActionExecutorDeps {
  context: ExecuteContext
  bindingContext: () => BindingContext
  stateManager: StateManager
  formManager: FormManager
  modalManager: ModalManager
  toastManager: ToastManager
  confirmManager: ConfirmManager
  dataResolver: DataResolver
  router: RouterAdapter
  actions: ActionDef[]
}

export class ActionExecutor {
  private readonly ctx: ExecuteContext
  private readonly deps: Omit<ActionExecutorDeps, 'context'>

  constructor({ context, ...deps }: ActionExecutorDeps) {
    this.ctx = context
    this.deps = deps
  }

  async execute(actionId: string, correlationId?: string, triggerArgs?: unknown): Promise<ExecuteResult> {
    const id = correlationId ?? generateCorrelationId()
    const action = this.deps.actions.find(a => a.id === actionId)
    if (!action) {
      return { actionId, success: false, error: `Action not found: ${actionId}`, durationMs: 0, correlationId: id }
    }

    // ── Permission check ────────────────────────────────────────────────────
    // When an action declares `requireGroups`, the current user must have at
    // least one of them. Failing this short-circuits dispatch, shows a toast,
    // and posts a DENIED entry to /action-logs — satisfying the POC "permission
    // denial logged" acceptance criterion.
    if (action.requireGroups && action.requireGroups.length > 0) {
      const userGroups = this.deps.bindingContext().user?.groups ?? []
      const allowed = action.requireGroups.some(g => userGroups.includes(g))
      if (!allowed) {
        this.deps.toastManager.show({
          title: 'Not allowed',
          description: `You do not have permission to run "${action.name}".`,
          variant: 'error',
        })
        this.logResult({
          actionId,
          success: false,
          error: `Denied — requires one of: ${action.requireGroups.join(', ')}`,
          durationMs: 0,
          correlationId: id,
        }, action, 'DENIED')
        return {
          actionId,
          success: false,
          error: 'Permission denied',
          durationMs: 0,
          correlationId: id,
        }
      }
    }

    const start = Date.now()
    let success = false
    let data: unknown
    let error: string | undefined

    try {
      data = await this.dispatch(action, id, triggerArgs)
      success = true
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }

    const durationMs = Date.now() - start
    const result: ExecuteResult = error !== undefined
      ? { actionId, success, data, error, durationMs, correlationId: id }
      : { actionId, success, data, durationMs, correlationId: id }
    this.logResult(result, action, success ? 'SUCCESS' : 'ERROR')

    if (success && action.outcomes?.onSuccess) {
      for (const nextId of action.outcomes.onSuccess) {
        await this.execute(nextId, id, triggerArgs)
      }
    } else if (!success && action.outcomes?.onError) {
      for (const nextId of action.outcomes.onError) {
        await this.execute(nextId, id, triggerArgs)
      }
    }

    return result
  }

  private async dispatch(action: ActionDef, correlationId: string, triggerArgs?: unknown): Promise<unknown> {
    const bc = this.deps.bindingContext()
    // Merge trigger args under `event` so config templates like
    // `{{event.shipmentId}}` resolve to row/click data passed by the component.
    const bcWithEvent = triggerArgs !== undefined
      ? ({ ...bc, event: triggerArgs } as unknown as BindingContext)
      : bc
    const cfg = interpolate(action.config as Record<string, unknown>, bcWithEvent) as Record<string, unknown>

    switch (action.type) {
      case 'API_CALL':
        return this.apiCall(cfg, correlationId)

      case 'REFRESH_DATASOURCE': {
        const alias = String(cfg['alias'] ?? '')
        await this.deps.dataResolver.resolveSourceByAlias(alias)
        return null
      }

      case 'NAVIGATE': {
        const path = String(cfg['path'] ?? '/')
        this.deps.router.push(path)
        return null
      }

      case 'OPEN_URL': {
        const url = String(cfg['url'] ?? '')
        const target = String(cfg['target'] ?? '_blank')
        if (typeof window !== 'undefined') window.open(url, target)
        return null
      }

      case 'SET_STATE': {
        const key = String(cfg['key'] ?? '')
        this.deps.stateManager.set(key, cfg['value'])
        return null
      }

      case 'RESET_STATE': {
        const key = String(cfg['key'] ?? '')
        this.deps.stateManager.reset(key)
        return null
      }

      case 'TOGGLE_STATE': {
        const key = String(cfg['key'] ?? '')
        this.deps.stateManager.toggle(key)
        return null
      }

      case 'SHOW_MODAL': {
        const modalId = String(cfg['modalId'] ?? '')
        this.deps.modalManager.show(modalId)
        return null
      }

      case 'CLOSE_MODAL': {
        const modalId = String(cfg['modalId'] ?? '')
        this.deps.modalManager.hide(modalId)
        return null
      }

      case 'SHOW_TOAST': {
        const toastOpts: Parameters<ToastManager['show']>[0] = {
          title: String(cfg['title'] ?? ''),
        }
        if (cfg['description'] != null) toastOpts.description = String(cfg['description'])
        if (cfg['variant'] != null) toastOpts.variant = String(cfg['variant'])
        if (cfg['duration'] != null) toastOpts.duration = Number(cfg['duration'])
        this.deps.toastManager.show(toastOpts)
        return null
      }

      case 'SHOW_CONFIRM': {
        const confirmed = await this.deps.confirmManager.show({
          title: String(cfg['title'] ?? 'Confirm'),
          message: String(cfg['message'] ?? ''),
        })
        return confirmed
      }

      case 'SUBMIT_FORM': {
        const formId = String(cfg['formId'] ?? '')
        const ok = await this.deps.formManager.submit(formId)
        if (!ok) throw new Error('Form validation failed')
        return null
      }

      case 'RESET_FORM': {
        const formId = String(cfg['formId'] ?? '')
        this.deps.formManager.reset(formId)
        return null
      }

      case 'SET_FORM_VALUE': {
        const formId = String(cfg['formId'] ?? '')
        const field = String(cfg['field'] ?? '')
        this.deps.formManager.setValue(formId, field, cfg['value'])
        return null
      }

      case 'TRIGGER_WEBHOOK': {
        const url = String(cfg['url'] ?? '')
        const ac = new AbortController()
        const timer = setTimeout(() => ac.abort(), 10_000)
        void fetch(url, {
          method: String(cfg['method'] ?? 'POST'),
          headers: { 'Content-Type': 'application/json' },
          body: cfg['body'] != null ? JSON.stringify(cfg['body']) : null,
          signal: ac.signal,
        }).finally(() => clearTimeout(timer))
        return null
      }

      case 'RUN_SEQUENCE': {
        const ids = (cfg['actions'] as string[] | undefined) ?? []
        const stopOnError = cfg['stopOnError'] !== false
        let last: unknown = null
        for (const id of ids) {
          const res = await this.execute(id, correlationId)
          if (!res.success && stopOnError) throw new Error(res.error ?? 'Sequence step failed')
          last = res.data
        }
        return last
      }

      case 'RUN_PARALLEL': {
        const ids = (cfg['actions'] as string[] | undefined) ?? []
        const waitForAll = cfg['waitForAll'] !== false
        const promises = ids.map(id => this.execute(id, correlationId))
        if (waitForAll) {
          const results = await Promise.all(promises)
          return results.map(r => r.data)
        } else {
          const result = await Promise.race(promises)
          return result.data
        }
      }

      case 'CONDITIONAL': {
        const condition = cfg['condition']
        const truthy = Boolean(condition)
        const branch = truthy ? (cfg['onTrue'] as string | undefined) : (cfg['onFalse'] as string | undefined)
        if (branch) await this.execute(branch, correlationId)
        return truthy
      }

      case 'DELAY': {
        const ms = Number(cfg['ms'] ?? 0)
        await new Promise<void>(resolve => setTimeout(resolve, ms))
        return null
      }

      default:
        throw new Error(`Unhandled action type: ${String(action.type)}`)
    }
  }

  private async apiCall(cfg: Record<string, unknown>, correlationId: string): Promise<unknown> {
    const res = await fetch(`${this.ctx.backendUrl}/connector/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.ctx.accessToken}`,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify({
        appId: this.ctx.appId,
        pageId: this.ctx.pageId,
        ...cfg,
      }),
    })
    if (!res.ok) throw new Error(`API call failed: ${res.status}`)
    return res.json() as Promise<unknown>
  }

  private logResult(
    result: ExecuteResult,
    action: ActionDef,
    status: 'SUCCESS' | 'ERROR' | 'DENIED',
  ): void {
    void fetch(`${this.ctx.backendUrl}/action-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.ctx.accessToken}`,
      },
      body: JSON.stringify({
        events: [{
          appId: this.ctx.appId,
          pageId: this.ctx.pageId,
          userId: this.ctx.userId,
          actionId: result.actionId,
          actionName: action.name,
          actionType: action.type,
          status,
          durationMs: result.durationMs,
          error: result.error,
          correlationId: result.correlationId,
          executedAt: new Date().toISOString(),
        }],
      }),
    }).catch(() => { /* non-blocking, ignore errors */ })
  }
}
