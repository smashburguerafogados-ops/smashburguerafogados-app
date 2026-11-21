import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { keepListening } from '../lib/listen'
import { EMPTY_RAFFLE, watchRaffle, type Raffle } from '../lib/raffle'

const RaffleContext = createContext<Raffle>(EMPTY_RAFFLE)

export function RaffleProvider({ children }: { children: ReactNode }) {
  const [raffle, setRaffle] = useState<Raffle>(EMPTY_RAFFLE)

  useEffect(
    () =>
      keepListening(
        (fail) => watchRaffle((next) => setRaffle(next), fail),
        () => setRaffle(EMPTY_RAFFLE),
      ),
    [],
  )

  return <RaffleContext.Provider value={raffle}>{children}</RaffleContext.Provider>
}

export function useRaffle(): Raffle {
  return useContext(RaffleContext)
}
