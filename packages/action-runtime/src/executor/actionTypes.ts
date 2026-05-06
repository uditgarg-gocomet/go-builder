export interface ExecuteContext {
  appId: string
  pageId: string
  userId: string
  environment: 'STAGING' | 'PRODUCTION'
  backendUrl: string
  accessToken: string
}

export interface ExecuteResult {
  actionId: string
  success: boolean
  data?: unknown
  error?: string | undefined
  durationMs: number
  correlationId: string
}

export interface ModalManager {
  show(modalId: string): void
  hide(modalId: string): void
}

export interface ToastManager {
  show(opts: { title: string; description?: string; variant?: string; duration?: number }): void
}

export interface ConfirmManager {
  show(opts: { title: string; message: string }): Promise<boolean>
}

export interface DataResolver {
  resolveSourceByAlias(alias: string): Promise<void>
}

export interface RouterAdapter {
  push(path: string): void
}
