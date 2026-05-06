'use client'

import React, { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { ActionDef } from '@portal/core'

const ACTION_TYPES: ActionDef['type'][] = [
  'API_CALL', 'NAVIGATE', 'OPEN_URL', 'SET_STATE', 'RESET_STATE', 'TOGGLE_STATE',
  'SHOW_MODAL', 'CLOSE_MODAL', 'SHOW_TOAST', 'SHOW_CONFIRM',
  'SUBMIT_FORM', 'RESET_FORM', 'SET_FORM_VALUE',
  'TRIGGER_WEBHOOK', 'RUN_SEQUENCE', 'RUN_PARALLEL', 'CONDITIONAL', 'DELAY',
  'REFRESH_DATASOURCE',
]

function emptyAction(): Partial<ActionDef> {
  return { id: crypto.randomUUID(), name: '', type: 'API_CALL', config: {} }
}

interface ConfigFieldsProps {
  type: ActionDef['type']
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  actions: ActionDef[]
}

function ConfigFields({ type, config, onChange, actions }: ConfigFieldsProps): React.ReactElement {
  const field = (key: string, label: string, placeholder?: string): React.ReactElement => (
    <label key={key} className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input value={String(config[key] ?? '')} onChange={e => onChange({ ...config, [key]: e.target.value })}
        placeholder={placeholder}
        className="rounded border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
    </label>
  )

  const actionSelect = (key: string, label: string): React.ReactElement => (
    <label key={key} className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select value={String(config[key] ?? '')} onChange={e => onChange({ ...config, [key]: e.target.value })}
        className="rounded border border-input bg-background px-2.5 py-1.5 text-sm outline-none">
        <option value="">— None —</option>
        {actions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </label>
  )

  switch (type) {
    case 'API_CALL':
      return <>{field('endpointId', 'Endpoint ID', 'endpoint-id')}{field('transform', 'Transform (JSONata)', 'result.data')}</>

    case 'NAVIGATE':
      return <>{field('path', 'Path', '/page-slug')}</>

    case 'OPEN_URL':
      return (
        <>
          {field('url', 'URL', 'https://example.com')}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={Boolean(config['newTab'])} onChange={e => onChange({ ...config, newTab: e.target.checked })} className="accent-primary" />
            Open in new tab
          </label>
        </>
      )

    case 'SET_STATE':
      return <>{field('key', 'State key')}{field('value', 'Value expression', '{{datasource.alias.value}}')}</>

    case 'RESET_STATE':
    case 'TOGGLE_STATE':
      return <>{field('key', 'State key')}</>

    case 'SHOW_MODAL':
    case 'CLOSE_MODAL':
      return <>{field('modalId', 'Modal node ID')}</>

    case 'SHOW_TOAST':
      return (
        <>
          {field('title', 'Title')}
          {field('description', 'Description')}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Variant</span>
            <select value={String(config['variant'] ?? 'default')} onChange={e => onChange({ ...config, variant: e.target.value })}
              className="rounded border border-input bg-background px-2.5 py-1.5 text-sm outline-none">
              {['default', 'success', 'warning', 'error'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          {field('duration', 'Duration (ms)', '3000')}
        </>
      )

    case 'SHOW_CONFIRM':
      return <>{field('title', 'Title')}{field('message', 'Message')}</>

    case 'TRIGGER_WEBHOOK':
      return (
        <>
          {field('url', 'Webhook URL')}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Method</span>
            <select value={String(config['method'] ?? 'POST')} onChange={e => onChange({ ...config, method: e.target.value })}
              className="rounded border border-input bg-background px-2.5 py-1.5 text-sm outline-none">
              {['POST', 'PUT', 'PATCH', 'GET'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </>
      )

    case 'RUN_SEQUENCE':
      return (
        <>
          {actionSelect('actions', 'First action')}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={Boolean(config['stopOnError'] ?? true)} onChange={e => onChange({ ...config, stopOnError: e.target.checked })} className="accent-primary" />
            Stop on error
          </label>
        </>
      )

    case 'RUN_PARALLEL':
      return (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={Boolean(config['waitForAll'] ?? true)} onChange={e => onChange({ ...config, waitForAll: e.target.checked })} className="accent-primary" />
          Wait for all
        </label>
      )

    case 'CONDITIONAL':
      return <>{field('condition', 'Condition expression', '{{state.isVisible}}')}{actionSelect('onTrue', 'On true')}{actionSelect('onFalse', 'On false')}</>

    case 'DELAY':
      return <>{field('ms', 'Delay (ms)', '1000')}</>

    case 'SUBMIT_FORM':
    case 'RESET_FORM':
      return <>{field('formId', 'Form ID')}</>

    case 'SET_FORM_VALUE':
      return <>{field('formId', 'Form ID')}{field('field', 'Field name')}{field('value', 'Value')}</>

    case 'REFRESH_DATASOURCE':
      return <>{field('alias', 'Data source alias')}</>

    default:
      return <p className="text-xs text-muted-foreground">No config needed.</p>
  }
}

interface ActionModalProps {
  initial: Partial<ActionDef>
  actions: ActionDef[]
  onSave: (a: ActionDef) => void
  onClose: () => void
}

function ActionModal({ initial, actions, onSave, onClose }: ActionModalProps): React.ReactElement {
  const [form, setForm] = useState<Partial<ActionDef>>(initial)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{initial.name ? 'Edit' : 'Add'} Action</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Type</span>
            <select value={form.type ?? 'API_CALL'} onChange={e => setForm(f => ({ ...f, type: e.target.value as ActionDef['type'], config: {} }))}
              className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none">
              {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <div className="flex flex-col gap-2 rounded border border-border bg-background p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Config</p>
            <ConfigFields
              type={form.type ?? 'API_CALL'}
              config={(form.config as Record<string, unknown>) ?? {}}
              onChange={config => setForm(f => ({ ...f, config }))}
              actions={actions}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="button" onClick={() => onSave(form as ActionDef)}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">Save</button>
        </div>
      </div>
    </div>
  )
}

export function ActionPanel(): React.ReactElement {
  const actions = useAppStore(s => s.actions)
  const addAction = useAppStore(s => s.addAction)
  const updateAction = useAppStore(s => s.updateAction)
  const removeAction = useAppStore(s => s.removeAction)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; initial: Partial<ActionDef> } | null>(null)

  const handleSave = (a: ActionDef): void => {
    if (modal?.mode === 'add') addAction(a)
    else updateAction(a.id, a)
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Actions</h3>
        <button type="button" onClick={() => setModal({ mode: 'add', initial: emptyAction() })}
          className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">+ Add</button>
      </div>

      {actions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No actions defined.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {actions.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded border border-border bg-background px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.type}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setModal({ mode: 'edit', initial: a })}
                  className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                <button type="button" onClick={() => removeAction(a.id)}
                  className="text-xs text-destructive hover:opacity-70">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <ActionModal initial={modal.initial} actions={actions} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  )
}
