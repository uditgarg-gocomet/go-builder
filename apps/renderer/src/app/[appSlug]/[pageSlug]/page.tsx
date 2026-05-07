import React from 'react'

interface PageProps {
  params: Promise<{ appSlug: string; pageSlug: string }>
}

// Placeholder — full schema renderer implemented in Session 6.2
export default async function PortalPage({ params }: PageProps): Promise<React.ReactElement> {
  const { appSlug, pageSlug } = await params

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground capitalize">
          {appSlug.replace(/-/g, ' ')}
        </h1>
        <p className="text-muted-foreground">Page: {pageSlug}</p>
        <p className="text-sm text-muted-foreground">
          Schema renderer will be wired up in the next session.
        </p>
      </div>
    </div>
  )
}

export async function generateStaticParams(): Promise<Array<{ appSlug: string; pageSlug: string }>> {
  // Will be populated with real deployment data in Session 6.2
  return []
}
