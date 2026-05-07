'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  nodeId: string
  componentType: string
}

interface State {
  hasError: boolean
  error: Error | null
}

function ComponentError({ nodeId, componentType, error }: { nodeId: string; componentType: string; error: Error | null }): React.ReactElement {
  return (
    <div className="border border-red-300 bg-red-50 p-3 rounded text-xs text-red-700 space-y-1">
      <div className="font-semibold">Component unavailable: {componentType}</div>
      {error && <div className="opacity-75">{error.message}</div>}
      <div className="opacity-50 font-mono">id: {nodeId}</div>
    </div>
  )
}

export class TrackedErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Report to Sentry if available
    try {
      if (typeof window !== 'undefined' && 'Sentry' in window) {
        const Sentry = (window as unknown as { Sentry: { captureException: (e: Error, ctx: Record<string, unknown>) => void } }).Sentry
        Sentry.captureException(error, {
          extra: {
            nodeId: this.props.nodeId,
            componentType: this.props.componentType,
            componentStack: info.componentStack,
          },
        })
      }
    } catch {
      // Ignore Sentry errors
    }
    console.error(`[TrackedErrorBoundary] ${this.props.componentType} (${this.props.nodeId}):`, error)
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <ComponentError
          nodeId={this.props.nodeId}
          componentType={this.props.componentType}
          error={this.state.error}
        />
      )
    }
    return this.props.children
  }
}
