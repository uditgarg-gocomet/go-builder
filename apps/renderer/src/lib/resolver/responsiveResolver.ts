'use client'

import { useState, useEffect } from 'react'
import type { ComponentNode } from '@portal/core'

export type Breakpoint = 'desktop' | 'tablet' | 'mobile'

// SSR-safe breakpoint detection using MediaQueryList
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop')

  useEffect(() => {
    const tabletQuery = window.matchMedia('(max-width: 1024px) and (min-width: 641px)')
    const mobileQuery = window.matchMedia('(max-width: 640px)')

    function update(): void {
      if (mobileQuery.matches) {
        setBreakpoint('mobile')
      } else if (tabletQuery.matches) {
        setBreakpoint('tablet')
      } else {
        setBreakpoint('desktop')
      }
    }

    update()

    tabletQuery.addEventListener('change', update)
    mobileQuery.addEventListener('change', update)

    return () => {
      tabletQuery.removeEventListener('change', update)
      mobileQuery.removeEventListener('change', update)
    }
  }, [])

  return breakpoint
}

export function useResponsiveProps(node: ComponentNode): Record<string, unknown> {
  const breakpoint = useBreakpoint()

  if (breakpoint === 'desktop') return {}

  const overrides = node.responsive[breakpoint]
  return overrides ?? {}
}
