import { useEffect, useState } from 'react'

/**
 * A per-instance rolling value history. Each KpiTile that displays a
 * numeric value calls this with its current value; since the page
 * re-renders every simulation tick, this captures one sample per tick
 * without needing a separate subscription or shared store.
 */
export function useHistory(value: number | null, length = 30): number[] {
  const [hist, setHist] = useState<number[]>(() => (value === null ? [] : [value]))

  useEffect(() => {
    if (value === null) return
    setHist((h) => [...h, value].slice(-length))
  }, [value, length])

  return hist
}
