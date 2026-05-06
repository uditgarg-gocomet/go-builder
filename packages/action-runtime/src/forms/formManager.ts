export interface FormField {
  name: string
  value: unknown
  error?: string
  touched: boolean
  dirty: boolean
}

export interface FormState {
  fields: Record<string, FormField>
  isSubmitting: boolean
  isValid: boolean
  submitCount: number
}

export class FormManager {
  private state: FormState = {
    fields: {},
    isSubmitting: false,
    isValid: true,
    submitCount: 0,
  }

  private listeners: Array<(state: FormState) => void> = []

  setField(name: string, value: unknown): void {
    const prev = this.state.fields[name]
    this.state = {
      ...this.state,
      fields: {
        ...this.state.fields,
        [name]: {
          name,
          value,
          error: prev?.error,
          touched: true,
          dirty: true,
        },
      },
    }
    this.notify()
  }

  getState(): FormState {
    return this.state
  }

  reset(): void {
    this.state = {
      fields: {},
      isSubmitting: false,
      isValid: true,
      submitCount: 0,
    }
    this.notify()
  }

  subscribe(listener: (state: FormState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }
}
