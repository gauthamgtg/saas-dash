'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { normalizeRow } from '@/src/lib/normalize'
import type { BlockingIssue, Issue } from '@/src/lib/normalize'
import { findWarnings } from '@/src/lib/issues'
import { IssueFixer } from '@/src/components/upload/IssueFixer'
import type { ColumnField } from '@/src/lib/mapping'
import type { DateOrder } from '@/src/lib/date'
import type { Transaction } from '@/src/lib/types'

const isBlank = (it: Issue): it is Extract<Issue, { kind: 'blank' }> => !it.blocking && it.kind === 'blank'

export function DataIssues() {
  const { state, dispatch } = useApp()

  const warnings = useMemo(
    () => (state.transactions ? findWarnings(state.transactions).filter((w) => !state.dismissedWarningIds.includes(w.id)) : []),
    [state.transactions, state.dismissedWarningIds],
  )
  const allIssues: Issue[] = [...state.issues, ...warnings]

  function handleFix(ids: string[], patch: Partial<Record<ColumnField, string>>, order?: Exclude<DateOrder, 'auto'>) {
    if (!state.mapping) return
    const targets = allIssues.filter((it) => ids.includes(it.id))

    const blockingResults = targets.filter((it): it is BlockingIssue => it.blocking).map((it) => {
      const patchedRaw = { ...it.raw }
      for (const [field, value] of Object.entries(patch)) {
        const col = state.mapping![field as ColumnField]
        if (col) patchedRaw[col] = value
      }
      const dateOrder = order ?? state.resolvedDateOrder ?? 'mdy'
      const result = normalizeRow(patchedRaw, it.rowIndex, state.mapping!, state.fxRates, { includeRefunds: state.controls.includeRefunds, dateOrder })
      return 'transaction' in result ? { id: it.id, transaction: result.transaction } : { id: it.id, issue: result.issue }
    })
    if (blockingResults.length) dispatch({ type: 'resolveIssues', results: blockingResults })

    const blankValue = Object.values(patch)[0] ?? ''
    const blankPatches = targets.filter(isBlank).map((it) => ({ paymentId: it.paymentId, patch: { [it.field]: blankValue } as Partial<Transaction> }))
    if (blankPatches.length) dispatch({ type: 'patchTransactions', patches: blankPatches })
  }

  function handleRemove(ids: string[]) {
    const targets = allIssues.filter((it) => ids.includes(it.id))
    const blockingIds = targets.filter((it) => it.blocking).map((it) => it.id)
    if (blockingIds.length) dispatch({ type: 'removeIssues', ids: blockingIds })
    const paymentIds = targets.filter(isBlank).map((it) => it.paymentId)
    if (paymentIds.length) dispatch({ type: 'removeTransactions', paymentIds })
  }

  function handleRemoveMember(paymentId: string) {
    dispatch({ type: 'removeTransactions', paymentIds: [paymentId] })
  }

  function handleDismiss(ids: string[]) {
    dispatch({ type: 'dismissWarnings', ids })
  }

  return (
    <section className="space-y-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Data Issues</h2>
      {state.mapping ? (
        <IssueFixer issues={allIssues} mapping={state.mapping} onFix={handleFix} onRemove={handleRemove}
          onRemoveMember={handleRemoveMember} onDismiss={handleDismiss} />
      ) : (
        <p className="text-sm text-ink-soft">No column mapping on record — re-upload to fix remaining issues.</p>
      )}
    </section>
  )
}
