/**
 * Shareable read-only links: the full dataset + settings, gzipped (native CompressionStream)
 * and base64url-encoded into the URL hash. No server — the link IS the data.
 */

export async function encodeShare(payload: object): Promise<string> {
  const stream = new Blob([JSON.stringify(payload)]).stream().pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function decodeShare(encoded: string): Promise<Record<string, any> | null> {
  try {
    const bin = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    return JSON.parse(await new Response(stream).text())
  } catch {
    return null
  }
}
