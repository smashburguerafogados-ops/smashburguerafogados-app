import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { EMPTY_RAFFLE, watchRaffle, type Raffle } from '../lib/raffle'

const RaffleContext = createContext<Raffle>(EMPTY_RAFFLE)

export function RaffleProvider({ children }: { children: ReactNode }) {
  const [raffle, setRaffle] = useState<Raffle>(EMPTY_RAFFLE)

  useEffect(
    () =>
      watchRaffle(
        (next) => setRaffle(next),
        () => setRaffle(EMPTY_RAFFLE),
      ),
    [],
  )

  return <RaffleContext.Provider value={raffle}>{children}</RaffleContext.Provider>
}

export function useRaffle(): Raffle {
  return useContext(RaffleContext)
}
