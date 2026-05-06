'use client'

import React, { useState } from 'react'
import { z } from 'zod'
import { useCanvasStore } from '@/stores/canvasStore'
import { BindingInput } from './BindingInput'
import { StaticInput } from './StaticInput'

interface PropFieldProps {
  nodeId: string
  propKey: string
  zodType: z.ZodTypeAny
  currentValue: unknown
  currentBinding: string | undefined
}

function labelFor(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
}

export function PropField({ nodeId, propKey, zodType, currentValue, currentBinding }: PropFieldProps): React.ReactElement {
  const [isBinding, setIsBinding] = useState(Boolean(currentBinding))
  const updateProps = useCanvasStore(s => s.updateProps)
  const updateBinding = useCanvasStore(s => s.updateBinding)

  const handleStaticChange = (value: unknown): void => {
    updateProps(nodeId, { [propKey]: value })
  }

  const handleBindingChange = (expression: string): void => {
    updateBinding(nodeId, propKey, expression)
  }

  const toggleMode = (): void => {
    setIsBinding(prev => !prev)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">{labelFor(propKey)}</label>
        <button
          type="button"
          onClick={toggleMode}
          title={isBinding ? 'Switch to static value' : 'Switch to binding expression'}
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            isBinding
              ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
              : 'bg-secondary text-muted-foreground hover:bg-accent'
          }`}
        >
          {isBinding ? '{{}}' : 'Static'}
        </button>
      </div>

      {isBinding ? (
        <BindingInput
          value={currentBinding ?? ''}
          onChange={handleBindingChange}
          placeholder={`{{datasource.alias.${propKey}}}`}
        />
      ) : (
        <StaticInput
          zodType={zodType}
          value={currentValue}
          onChange={handleStaticChange}
          propKey={propKey}
        />
      )}
    </div>
  )
}
