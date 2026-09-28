import type { Metadata } from 'next'

// The dashboard is per-user and data lives in the browser — keep it out of search results.
export const metadata: Metadata = { title: 'Dashboard — MRRmark', robots: { index: false, follow: false } }

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children
}
