import type { FormDef, FormFieldDef } from '@portal/core'
import { runValidations } from './formValidation.js'

export interface FormField {
  name: string
  value: unknown
  error: string | undefined
  touched: boolean
  dirty: boolean
}

export interface FormState {
  fields: Record<string, FormField>
  isSubmitting: boolean
  isValid: boolean
  submitCount: number
}

type FormListener = (formId: string, state: FormState) => void

export class FormManager {
  private readonly forms = new Map<string, FormState>()
  private readonly defs = new Map<string, FormDef>()
  private listeners: Set<FormListener> = new Set()
  private syncToContext: ((formId: string, state: FormState) => void) | undefined

  initialize(formDefs: FormDef[], onSync?: (formId: string, state: FormState) => void): void {
    this.syncToContext = onSync
    for (const def of formDefs) {
      const fields: Record<string, FormField> = {}
      for (const field of def.fields) {
        fields[field.name] = {
          name: field.name,
          value: field.defaultValue ?? '',
          error: undefined,
          touched: false,
          dirty: false,
        }
      }
      this.forms.set(def.id, {
        fields,
        isSubmitting: false,
        isValid: true,
        submitCount: 0,
      })
      this.defs.set(def.id, def)
    }
  }

  setValue(formId: string, fieldName: string, value: unknown): void {
    const state = this.getState(formId)
    const prev = state.fields[fieldName]
    const updated: FormState = {
      ...state,
      fields: {
        ...state.fields,
        [fieldName]: {
          name: fieldName,
          value,
          error: prev?.error,
          touched: true,
          dirty: true,
        },
      },
    }
    this.forms.set(formId, updated)
    void this.validateFieldAsync(formId, fieldName, value)
    this.notify(formId)
  }

  async validateField(formId: string, fieldName: string, value: unknown): Promise<string | null> {
    const def = this.defs.get(formId)
    const fieldDef = def?.fields.find((f: FormFieldDef) => f.name === fieldName)
    if (!fieldDef?.validations) return null
    const error = await runValidations(fieldDef.validations, value)
    const state = this.getState(formId)
    this.forms.set(formId, {
      ...state,
      fields: {
        ...state.fields,
        [fieldName]: {
          ...(state.fields[fieldName] ?? { name: fieldName, value, touched: false, dirty: false }),
          error: error ?? undefined,
        },
      },
    })
    this.notify(formId)
    return error
  }

  async validateAll(formId: string): Promise<boolean> {
    const state = this.getState(formId)
    const def = this.defs.get(formId)
    const updatedFields: Record<string, FormField> = {}
    let isValid = true

    for (const [name, field] of Object.entries(state.fields)) {
      const fieldDef = def?.fields.find((f: FormFieldDef) => f.name === name)
      const error = fieldDef?.validations ? await runValidations(fieldDef.validations, field.value) : null
      if (error) isValid = false
      updatedFields[name] = { ...field, error: error ?? undefined, touched: true }
    }

    this.forms.set(formId, { ...state, fields: updatedFields, isValid })
    this.notify(formId)
    return isValid
  }

  async submit(formId: string): Promise<boolean> {
    const isValid = await this.validateAll(formId)
    if (!isValid) return false
    const state = this.getState(formId)
    this.forms.set(formId, {
      ...state,
      isSubmitting: true,
      submitCount: state.submitCount + 1,
    })
    this.notify(formId)
    return true
  }

  reset(formId: string): void {
    const def = this.defs.get(formId)
    if (!def) return
    const fields: Record<string, FormField> = {}
    for (const field of def.fields) {
      fields[field.name] = {
        name: field.name,
        value: field.defaultValue ?? '',
        error: undefined,
        touched: false,
        dirty: false,
      }
    }
    this.forms.set(formId, {
      fields,
      isSubmitting: false,
      isValid: true,
      submitCount: 0,
    })
    this.notify(formId)
  }

  getState(formId: string): FormState {
    return this.forms.get(formId) ?? {
      fields: {},
      isSubmitting: false,
      isValid: true,
      submitCount: 0,
    }
  }

  subscribe(listener: FormListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private validateFieldAsync(formId: string, fieldName: string, value: unknown): Promise<string | null> {
    return this.validateField(formId, fieldName, value)
  }

  private notify(formId: string): void {
    const state = this.getState(formId)
    this.syncToContext?.(formId, state)
    for (const listener of this.listeners) {
      listener(formId, state)
    }
  }
}
