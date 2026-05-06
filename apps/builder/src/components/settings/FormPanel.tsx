'use client'

import React, { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { FormDef, FormFieldDef } from '@portal/core'

const FIELD_TYPES: FormFieldDef['type'][] = [
  'text', 'email', 'number', 'select', 'multiselect', 'checkbox', 'textarea', 'date', 'file',
]

function emptyForm(): FormDef {
  return { id: `form-${Date.now()}`, fields: [], submitActionId: undefined, resetOnSubmit: true }
}

function emptyField(): FormFieldDef {
  return { name: '', label: '', type: 'text', required: false }
}

interface FormModalProps {
  initial: FormDef
  onSave: (f: FormDef) => void
  onClose: () => void
}

function FormModal({ initial, onSave, onClose }: FormModalProps): React.ReactElement {
  const [form, setForm] = useState<FormDef>(initial)
  const actions = useAppStore(s => s.actions)

  const addField = (): void => setForm(f => ({ ...f, fields: [...f.fields, emptyField()] }))
  const removeField = (i: number): void => setForm(f => ({ ...f, fields: f.fields.filter((_, idx) => idx !== i) }))
  const updateField = (i: number, patch: Partial<FormFieldDef>): void =>
    setForm(f => ({
      ...f,
      fields: f.fields.map((field, idx) => idx === i ? { ...field, ...patch } : field),
    }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Form</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Form ID</span>
          <input value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
            className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Submit action</span>
          <select value={form.submitActionId ?? ''} onChange={e => setForm(f => ({ ...f, submitActionId: e.target.value || undefined }))}
            className="rounded border border-input bg-background px-3 py-1.5 text-sm outline-none">
            <option value="">— None —</option>
            {actions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fields</p>
            <button type="button" onClick={addField}
              className="text-xs text-primary hover:underline">+ Add field</button>
          </div>
          {form.fields.map((field, i) => (
            <div key={i} className="flex flex-col gap-2 rounded border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{field.name || `Field ${i + 1}`}</span>
                <button type="button" onClick={() => removeField(i)} className="text-xs text-destructive">Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">Name</span>
                  <input value={field.name} onChange={e => updateField(i, { name: e.target.value })}
                    className="rounded border border-input bg-background px-2 py-1 text-xs outline-none" />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">Label</span>
                  <input value={field.label} onChange={e => updateField(i, { label: e.target.value })}
                    className="rounded border border-input bg-background px-2 py-1 text-xs outline-none" />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">Type</span>
                  <select value={field.type} onChange={e => updateField(i, { type: e.target.value as FormFieldDef['type'] })}
                    className="rounded border border-input bg-background px-2 py-1 text-xs outline-none">
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground pt-4">
                  <input type="checkbox" checked={field.required} onChange={e => updateField(i, { required: e.target.checked })} className="accent-primary" />
                  Required
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="button" onClick={() => onSave(form)}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">Save</button>
        </div>
      </div>
    </div>
  )
}

export function FormPanel(): React.ReactElement {
  const forms = useAppStore(s => s.forms)
  const addForm = useAppStore(s => s.addForm)
  const updateForm = useAppStore(s => s.updateForm)
  const removeForm = useAppStore(s => s.removeForm)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; initial: FormDef } | null>(null)

  const handleSave = (f: FormDef): void => {
    if (modal?.mode === 'add') addForm(f)
    else updateForm(f.id, f)
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Forms</h3>
        <button type="button" onClick={() => setModal({ mode: 'add', initial: emptyForm() })}
          className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">+ Add</button>
      </div>

      {forms.length === 0 ? (
        <p className="text-xs text-muted-foreground">No forms defined.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {forms.map(f => (
            <div key={f.id} className="flex items-center justify-between rounded border border-border bg-background px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{f.id}</p>
                <p className="text-xs text-muted-foreground">{f.fields.length} fields</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setModal({ mode: 'edit', initial: f })}
                  className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                <button type="button" onClick={() => removeForm(f.id)}
                  className="text-xs text-destructive hover:opacity-70">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <FormModal initial={modal.initial} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  )
}
