type StateListener = (state: Record<string, unknown>) => void

export class StateManager {
  private state: Record<string, unknown>
  private readonly initialState: Record<string, unknown>
  private listeners: Set<StateListener> = new Set()

  constructor(initialState: Record<string, unknown> = {}, dispatch?: (state: Record<string, unknown>) => void) {
    this.initialState = { ...initialState }
    this.state = { ...initialState }
    if (dispatch) this.subscribe(dispatch)
  }

  get(key: string): unknown {
    return this.state[key]
  }

  getAll(): Record<string, unknown> {
    return { ...this.state }
  }

  set(key: string, value: unknown): void {
    this.state = { ...this.state, [key]: value }
    this.notify()
  }

  reset(key: string): void {
    const defaultValue = this.initialState[key]
    this.state = { ...this.state, [key]: defaultValue }
    this.notify()
  }

  toggle(key: string): void {
    this.state = { ...this.state, [key]: !this.state[key] }
    this.notify()
  }

  init(slots: Array<{ name: string; defaultValue: unknown }>): void {
    for (const slot of slots) {
      this.state[slot.name] = slot.defaultValue
      ;(this.initialState as Record<string, unknown>)[slot.name] = slot.defaultValue
    }
    this.notify()
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    const snapshot = this.getAll()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}
