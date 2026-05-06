type StateListener = (state: Record<string, unknown>) => void

export class StateManager {
  private state: Record<string, unknown> = {}
  private listeners: Set<StateListener> = new Set()

  init(slots: Array<{ name: string; defaultValue: unknown }>): void {
    for (const slot of slots) {
      this.state[slot.name] = slot.defaultValue
    }
    this.notify()
  }

  get(key: string): unknown {
    return this.state[key]
  }

  set(key: string, value: unknown): void {
    this.state = { ...this.state, [key]: value }
    this.notify()
  }

  getAll(): Record<string, unknown> {
    return { ...this.state }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.getAll())
    }
  }
}
