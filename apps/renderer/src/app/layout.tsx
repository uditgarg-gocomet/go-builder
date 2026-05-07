import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Client Portal',
  description: 'Client Portal',
}

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
