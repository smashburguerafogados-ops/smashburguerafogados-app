/** The one place the shop schedule reads the time, so tests can pin it. */
export const clock = {
  now: (): number => Date.now(),
}
