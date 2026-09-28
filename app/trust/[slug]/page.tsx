import { getPublicTrust } from '@/src/server/repo'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { TrustPage } from '@/src/components/trust/TrustPage'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const trust = await getPublicTrust(slug)
  if (!trust) return { title: 'Not found · MRRmark Trust' }
  return {
    title: `${trust.companyName} — Verified MRR · MRRmark Trust`,
    description: `Verified MRR for ${trust.companyName}. Source of truth via MRRmark.`,
    openGraph: {
      title: `${trust.companyName} verified MRR`,
      description: `MRR verified on MRRmark Trust`,
    },
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  const trust = await getPublicTrust(slug)
  if (!trust) notFound()
  return (
    <TrustPage
      companyName={trust.companyName}
      website={trust.website}
      verifiedMrr={trust.verifiedMrr}
      verifiedArr={trust.verifiedArr}
      customerCount={trust.customerCount}
      sparkline={JSON.parse(trust.sparklineJson || '[]') as number[]}
      currency={trust.currency}
      source={trust.source}
      lastVerifiedAt={trust.lastVerifiedAt}
      publicSlug={trust.publicSlug}
    />
  )
}
