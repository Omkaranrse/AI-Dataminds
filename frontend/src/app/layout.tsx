import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aether Data - Autonomous AI Data Analysis Platform',
  description: 'Clean, profile, analyze, and chat with your datasets using state-of-the-art multi-agent workflows.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-background to-background pointer-events-none -z-10" />
        {children}
      </body>
    </html>
  )
}
