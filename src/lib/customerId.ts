const CUSTOMER_KEY = 'smash.customerId'

/** The Firebase uid written to users/{uid} when the customer saved their data. */
export function readSavedCustomerId(): string {
  try {
    return localStorage.getItem(CUSTOMER_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveCustomerId(uid: string): void {
  try {
    localStorage.setItem(CUSTOMER_KEY, uid)
  } catch {
    // Storage can be blocked. Firebase Auth still restores the session.
  }
}

export function clearSavedCustomerId(): void {
  try {
    localStorage.removeItem(CUSTOMER_KEY)
  } catch {
    // Nothing to clear when storage is blocked.
  }
}
