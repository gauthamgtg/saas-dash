// Country name → flag emoji. Covers the common cases; unknown names get a neutral globe.
const MAP: Record<string, string> = {
  'united states': '🇺🇸', usa: '🇺🇸', us: '🇺🇸', 'united states of america': '🇺🇸',
  canada: '🇨🇦', 'united kingdom': '🇬🇧', uk: '🇬🇧', 'great britain': '🇬🇧', england: '🇬🇧',
  germany: '🇩🇪', france: '🇫🇷', spain: '🇪🇸', italy: '🇮🇹', netherlands: '🇳🇱', ireland: '🇮🇪',
  sweden: '🇸🇪', norway: '🇳🇴', denmark: '🇩🇰', finland: '🇫🇮', switzerland: '🇨🇭', poland: '🇵🇱',
  portugal: '🇵🇹', belgium: '🇧🇪', austria: '🇦🇹',
  india: '🇮🇳', australia: '🇦🇺', singapore: '🇸🇬', japan: '🇯🇵', china: '🇨🇳', 'south korea': '🇰🇷',
  'new zealand': '🇳🇿', indonesia: '🇮🇩', philippines: '🇵🇭', malaysia: '🇲🇾', thailand: '🇹🇭', vietnam: '🇻🇳',
  brazil: '🇧🇷', mexico: '🇲🇽', argentina: '🇦🇷', chile: '🇨🇱', colombia: '🇨🇴',
  'south africa': '🇿🇦', nigeria: '🇳🇬', egypt: '🇪🇬', 'united arab emirates': '🇦🇪', uae: '🇦🇪',
  'saudi arabia': '🇸🇦', israel: '🇮🇱', turkey: '🇹🇷', russia: '🇷🇺', ukraine: '🇺🇦',
}

export function flag(country: string | null | undefined): string {
  if (!country) return '🏳️'
  return MAP[country.trim().toLowerCase()] ?? '🌐'
}
