export type ActionType =
  | 'API_CALL'
  | 'NAVIGATE'
  | 'SET_STATE'
  | 'SHOW_TOAST'
  | 'OPEN_MODAL'
  | 'CLOSE_MODAL'
  | 'SUBMIT_FORM'
  | 'RESET_FORM'
  | 'TRIGGER_WEBHOOK'
  | 'RUN_SEQUENCE'
  | 'CONDITIONAL'
  | 'INVALIDATE_DATASOURCE'

export interface ActionOutcome {
  onSuccess?: string[]
  onError?: string[]
}

export interface ActionDef {
  id: string
  name: string
  type: ActionType
  config: unknown
  outcomes?: ActionOutcome
}

export interface ExecuteContext {
  appId: string
  pageId: string
  userId: string
  correlationId: string
  environment: 'STAGING' | 'PRODUCTION'
  backendUrl: string
  accessToken: string
}

export interface ExecuteResult {
  success: boolean
  data?: unknown
  error?: string
  durationMs: number
}
