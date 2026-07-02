import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SaaS Revenue Analytics',
  description: 'Upload revenue data, get full analytics.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
