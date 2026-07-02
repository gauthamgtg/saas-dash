'use client'
import { AppProvider } from '@/src/state/AppContext'
import { Shell } from '@/src/components/Shell'

export default function Page() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
