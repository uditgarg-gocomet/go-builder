import { useEffect } from 'react'

export function useThemeTokens(tokens: Record<string, string> | undefined): void {
  useEffect(() => {
    if (!tokens) return
    const root = document.documentElement
    for (const [key, value] of Object.entries(tokens)) {
      root.style.setProperty(key.startsWith('--') ? key : `--${key}`, value)
    }
  }, [tokens])
}
