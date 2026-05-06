import React from 'react'
import { z } from 'zod'
import { cn } from '../../lib/utils.js'

export const ErrorBoundaryPropsSchema = z.object({
  fallbackTitle: z.string().default('Something went wrong'),
  showRetry: z.boolean().default(true),
  className: z.string().optional(),
})

export type ErrorBoundaryProps = z.infer<typeof ErrorBoundaryPropsSchema> & {
  children: React.ReactNode
  style?: React.CSSProperties
  onError?: (error: Error, info: React.ErrorInfo) => void
}

export const errorBoundaryManifest = {
  displayName: 'Error Boundary',
  category: 'Feedback',
  description: 'Catches React render errors and shows a fallback UI',
  icon: 'shield-alert',
  tags: ['error', 'boundary', 'fallback', 'resilience'],
}

interface ErrorBoundaryState { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={this.props.style}
          className={cn('flex flex-col items-center gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-6 text-center', this.props.className)}
        >
          <svg className="h-8 w-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-foreground">{this.props.fallbackTitle}</p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">{this.state.error.message}</p>
            )}
          </div>
          {this.props.showRetry && (
            <button onClick={this.handleRetry} className="text-sm font-medium text-primary hover:underline">
              Try again
            </button>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
