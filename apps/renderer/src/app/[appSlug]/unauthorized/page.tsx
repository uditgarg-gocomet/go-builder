import React from 'react'

interface PageProps {
  params: Promise<{ appSlug: string }>
}

export default async function UnauthorizedPage({ params }: PageProps): Promise<React.ReactElement> {
  const { appSlug } = await params

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="text-6xl">🔒</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view this page.
          </p>
        </div>
        <div className="space-y-2">
          <a
            href={`/${appSlug}`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Go to Home
          </a>
          <div>
            <a
              href={`/${appSlug}/login`}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Sign in with a different account
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
