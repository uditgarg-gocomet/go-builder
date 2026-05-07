import React from 'react'

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ appSlug: string }>
}

export default async function AppLayout({ children }: LayoutProps): Promise<React.ReactElement> {
  return <>{children}</>
}
