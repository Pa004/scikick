// Display names for canonicals that lost diacritics during ingestion
// (football-data.co.uk short codes). Storage, URLs and API payloads stay
// canonical; this maps render-time text only. Add entries as new cases surface.
const DISPLAY_NAMES: Record<string, string> = {
  Alaves: 'Alavés',
  Espanol: 'Español',
  Leganes: 'Leganés',
}

export function displayTeam(canonical: string): string {
  return DISPLAY_NAMES[canonical] ?? canonical
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export { stripDiacritics }

// Accent-insensitive matching so "alaves" finds Alavés either way.
export function teamMatchesQuery(canonical: string, query: string): boolean {
  const q = stripDiacritics(query.trim().toLowerCase())
  if (!q) return true
  const haystack = stripDiacritics(`${canonical} ${DISPLAY_NAMES[canonical] ?? ''}`.toLowerCase())
  return haystack.includes(q)
}
