'use client'
import { useEffect, useState } from 'react'

const KEY = 'ledger-annotations'
export type Note = { month: string; label: string }

/** Local (this-browser) chart annotations. True collaborative/shared comments need a backend the client-only app lacks. */
export function useAnnotations() {
  const [notes, setNotes] = useState<Note[]>([])
  useEffect(() => { try { const r = localStorage.getItem(KEY); if (r) setNotes(JSON.parse(r)) } catch {} }, [])
  const save = (n: Note[]) => { setNotes(n); try { localStorage.setItem(KEY, JSON.stringify(n)) } catch {} }
  return {
    notes,
    add: (month: string, label: string) => save([...notes, { month, label }]),
    clear: () => save([]),
  }
}
