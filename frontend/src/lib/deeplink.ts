// Shareable deep links without a router: ?partido=<id> auto-expands
// the card on load; expanding/collapsing syncs the URL via replaceState
// so the back button and pasted links work.

const PARAM = 'partido'

export function parseDeepLinkId(search: string): number | null {
  try {
    const raw = new URLSearchParams(search).get(PARAM)
    const id = raw === null ? NaN : Number.parseInt(raw, 10)
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export function getDeepLinkedFixtureId(): number | null {
  try {
    return parseDeepLinkId(window.location.search)
  } catch {
    return null
  }
}

export function syncDeepLink(fixtureId: number | null): void {
  try {
    const url = new URL(window.location.href)
    if (fixtureId === null) {
      url.searchParams.delete(PARAM)
    } else {
      url.searchParams.set(PARAM, String(fixtureId))
    }
    window.history.replaceState(null, '', url)
  } catch {
    // Non-browser env (tests): links simply don't sync
  }
}
