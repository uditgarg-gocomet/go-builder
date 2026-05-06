'use client'

import React, { useState } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useAppStore } from '@/stores/appStore'
import type { CanvasNode } from '@/types/canvas'

const COMMON_TRIGGERS = ['onClick', 'onChange', 'onSubmit', 'onBlur', 'onFocus']

interface ActionsEditorProps {
  nodeId: string
  node: CanvasNode
}

export function ActionsEditor({ nodeId, node }: ActionsEditorProps): React.ReactElement {
  const actions = useAppStore(s => s.actions)
  const updateActions = useCanvasStore(s => s.updateActions)
  const [editingTrigger, setEditingTrigger] = useState<string | null>(null)

  const boundActions = node.actions ?? []

  const getBinding = (trigger: string): CanvasNode['actions'][number] | undefined =>
    boundActions.find(a => a.trigger === trigger)

  const bindAction = (trigger: string, actionId: string): void => {
    const existing = boundActions.filter(a => a.trigger !== trigger)
    if (actionId) {
      updateActions(nodeId, [...existing, { trigger, actionId }])
    } else {
      updateActions(nodeId, existing)
    }
    setEditingTrigger(null)
  }

  return (
    <div className="flex flex-col gap-2">
      {COMMON_TRIGGERS.map(trigger => {
        const binding = getBinding(trigger)
        const boundAction = actions.find(a => a.id === binding?.actionId)

        return (
          <div key={trigger} className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{trigger}</span>
            {editingTrigger === trigger ? (
              <select
                autoFocus
                className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs outline-none"
                defaultValue={binding?.actionId ?? ''}
                onChange={e => bindAction(trigger, e.target.value)}
                onBlur={() => setEditingTrigger(null)}
              >
                <option value="">— None —</option>
                {actions.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={() => setEditingTrigger(trigger)}
                className={`flex-1 truncate rounded border px-2 py-1 text-left text-xs transition-colors ${
                  boundAction
                    ? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
                    : 'border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary'
                }`}
              >
                {boundAction ? boundAction.name : '+ Bind action'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
