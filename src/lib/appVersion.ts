import { useEffect, useState } from 'react'

export const APP_VERSION = __APP_VERSION__

export const VERSION_CHECK_MS = 5 * 60_000

/** The build GitHub Pages serves now, or null when it cannot be read. */
export async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return null
    const data = (await response.json()) as { version?: unknown }
    return typeof data.version === 'string' && data.version ? data.version : null
  } catch {
    return null
  }
}

/**
 * The deployed version once it differs from the one this tab runs. There is
 * no service worker, so an open tab keeps the old bundle until it reloads.
 * Checks when the tab comes back to the front, when the network returns, and
 * every few minutes while it stays visible.
 */
export function useNewVersion(enabled: boolean = import.meta.env.PROD): string {
  const [found, setFound] = useState('')

  useEffect(() => {
    if (!enabled || found) return
    let active = true

    async function check() {
      if (document.visibilityState === 'hidden') return
      const deployed = await fetchDeployedVersion()
      if (active && deployed && deployed !== APP_VERSION) setFound(deployed)
    }

    function onVisible() {
      if (document.visibilityState === 'visible') void check()
    }

    const timer = window.setInterval(() => void check(), VERSION_CHECK_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [enabled, found])

  return found
}
