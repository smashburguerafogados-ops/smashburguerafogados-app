export const RETRY_MS = [2_000, 5_000, 15_000, 30_000, 60_000]

/**
 * Firestore already reconnects a listener after a network drop. An error
 * (permission, quota, the login changing under it) closes the listener for
 * good, so this opens it again after a pause until the screen stops listening.
 */
export function keepListening(open: (onError: () => void) => () => void, onError: () => void): () => void {
  let stopped = false
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let stop: () => void = () => undefined

  function start() {
    stop = open(() => {
      onError()
      if (stopped) return
      const delay = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]
      attempt += 1
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (stopped) return
        stop()
        start()
      }, delay)
    })
  }

  start()
  return () => {
    stopped = true
    clearTimeout(timer)
    stop()
  }
}
