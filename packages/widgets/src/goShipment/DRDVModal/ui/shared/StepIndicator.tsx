'use client'

// Minimal two-step indicator — dots at endpoints joined by a thin line.
// Active dot is filled in primary blue; inactive is muted slate.

import React from 'react'

export interface StepIndicatorProps {
  currentStep: number
  steps: ReadonlyArray<{ title: string; disabled?: boolean }>
  onStepChange: (step: number) => void
}

export function StepIndicator({
  currentStep,
  steps,
  onStepChange,
}: StepIndicatorProps): React.ReactElement {
  return (
    <div className="flex items-center justify-center py-3">
      <div className="flex items-center gap-0 w-full max-w-3xl">
        {steps.map((step, idx) => {
          const isActive = idx <= currentStep
          const isClickable = !step.disabled
          const isLast = idx === steps.length - 1
          return (
            <React.Fragment key={step.title}>
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepChange(idx)}
                className={[
                  'flex flex-col items-center gap-1.5 shrink-0',
                  !isClickable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                ].join(' ')}
              >
                <span
                  className={[
                    'h-2.5 w-2.5 rounded-full transition-colors',
                    isActive
                      ? 'bg-blue-600 ring-4 ring-blue-100'
                      : 'bg-slate-300',
                  ].join(' ')}
                />
                <span
                  className={[
                    'text-xs',
                    isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {step.title}
                </span>
              </button>
              {!isLast && (
                <div
                  className={[
                    'h-px flex-1 transition-colors mb-5',
                    idx < currentStep ? 'bg-blue-600' : 'bg-slate-200',
                  ].join(' ')}
                  aria-hidden
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
