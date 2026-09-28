/**
 * Hand a file dropped on the landing page (/) to the importer (/app).
 * ponytail: module memory, not storage — it survives Next's client-side navigation, which is the
 * only path between the two pages. A hard reload drops it and the importer simply starts empty.
 */
let pending: File | null = null
export const setPendingFile = (f: File) => { pending = f }
export const hasPendingFile = () => pending != null
export const takePendingFile = () => { const f = pending; pending = null; return f }
