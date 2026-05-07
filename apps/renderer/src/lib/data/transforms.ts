import jsonata from 'jsonata'

export async function applyTransform(data: unknown, expression: string): Promise<unknown> {
  try {
    const expr = jsonata(expression)
    return await expr.evaluate(data as jsonata.Expression)
  } catch (err) {
    // Report to Sentry if available (browser-side only)
    if (typeof window !== 'undefined' && 'Sentry' in window) {
      try {
        const Sentry = (window as unknown as { Sentry: { captureException: (e: unknown) => void } }).Sentry
        Sentry.captureException(err)
      } catch {
        // ignore
      }
    }
    throw err
  }
}
