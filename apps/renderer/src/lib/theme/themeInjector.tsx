import React from 'react'

interface ThemeProviderProps {
  tokens?: Record<string, string>
  fonts?: string[]
  children: React.ReactNode
}

function buildCSSVariables(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([key, value]) => {
      // Ensure key is formatted as CSS variable (--key)
      const varName = key.startsWith('--') ? key : `--${key}`
      return `  ${varName}: ${value};`
    })
    .join('\n')
}

function buildFontImports(fonts: string[]): string {
  return fonts
    .map(font => {
      const family = encodeURIComponent(font.replace(/\s+/g, '+'))
      return `@import url('https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap');`
    })
    .join('\n')
}

export function ThemeProvider({ tokens, fonts, children }: ThemeProviderProps): React.ReactElement {
  const hasTokens = tokens && Object.keys(tokens).length > 0
  const hasFonts = fonts && fonts.length > 0

  if (!hasTokens && !hasFonts) {
    return <>{children}</>
  }

  const cssVariables = hasTokens ? buildCSSVariables(tokens) : ''
  const fontImports = hasFonts ? buildFontImports(fonts) : ''

  const styleContent = [
    fontImports,
    hasTokens ? `:root {\n${cssVariables}\n}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  return (
    <>
      {/* dangerouslySetInnerHTML is required here to inject dynamic CSS variables */}
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: styleContent }} />
      {children}
    </>
  )
}
