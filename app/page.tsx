import type { Metadata } from 'next'
import { Landing } from '@/src/components/landing/Landing'

const title = 'MRRmark — Revenue analytics from a payments export'
const description = 'Drop a CSV or Excel of payments and get MRR, retention, cohorts, forecasts, churn warnings and a board-ready pack in seconds. Runs entirely in your browser.'

export const metadata: Metadata = {
  title, description,
  openGraph: { title, description, type: 'website', siteName: 'MRRmark' },
  twitter: { card: 'summary_large_image', title, description },
}

export default function Home() {
  return <Landing />
}
