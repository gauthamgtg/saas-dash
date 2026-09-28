import Link from 'next/link'
import { Logo } from '@/src/components/ui/Logo'
import { ThemeToggle } from '@/src/components/ui/ThemeToggle'

/** Top bar for the public pages (landing, importer). Server-safe; `right` holds page-specific actions. */
export function SiteNav({ links = false, right }: { links?: boolean; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bone/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Ledger home">
          <Logo size={28} />
          <span className="text-[16px] font-semibold tracking-[-0.02em] text-ink">Ledger</span>
        </Link>
        {links && (
          <nav className="hidden items-center gap-6 text-[13.5px] text-ink-soft md:flex">
            <a href="#product" className="transition-colors hover:text-ink">Product</a>
            <a href="#features" className="transition-colors hover:text-ink">Features</a>
            <a href="#how" className="transition-colors hover:text-ink">How it works</a>
            <a href="#privacy" className="transition-colors hover:text-ink">Privacy</a>
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle compact />
          {right}
        </div>
      </div>
    </header>
  )
}
