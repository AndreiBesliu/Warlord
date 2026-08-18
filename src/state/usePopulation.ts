import { useEffect, useRef, useState } from 'react'
import {
  assignBlocker, handsAt, hydratePopulation, idleHands, type PopulationState,
} from '../logic/population'
import type { Building } from '../logic/types'

/**
 * The souls of the domain.
 *
 * Deliberately exports NO raw setter. Every way a soul can move goes through one of the
 * four doors below, so the claim ledger cannot be walked around by a caller who did not
 * know it was there.
 */
export function usePopulation(saved?: unknown) {
  const [population, setPopulation] = useState<PopulationState>(() => hydratePopulation(saved))

  // Hands promised in THIS frame but not yet visible in state.
  //
  // React state is a render snapshot: two dispatches in one event handler both read the same
  // `population`, so two checks against it can both pass and between them spend the same
  // hands twice. `assign` can defend itself inside its updater — it writes one slice. The
  // recruit path cannot: it also moves the wallet and the barracks pool, neither of which
  // can refuse, and a slice updater that bailed out there would leave 50 soldiers paid for
  // out of nothing. So for recruiting, THIS is the invariant and the souls updater is
  // unconditional. (Over-claiming is the safe direction: it refuses more, never less.)
  const claimed = useRef(0)
  useEffect(() => { claimed.current = 0 }) // every commit — by then the state is the truth

  /** Hands nobody has spoken for, this frame included. The number the two doors check. */
  function freeNow(buildings: Building[]): number {
    return Math.max(0, idleHands(population, buildings) - claimed.current)
  }

  /** Take hands out of the domain for good. The caller has already refused if it must. */
  function conscript(n: number): void {
    const take = Math.max(0, Math.floor(n || 0))
    if (take <= 0) return
    claimed.current += take
    setPopulation((p) => ({ ...p, souls: Math.max(0, p.souls - take) }))
  }

  /** Post or unpost hands at a building. Silent when refused — the screen said why first. */
  function assign(b: Building, delta: number, buildings: Building[]): void {
    const n = Math.floor(delta || 0)
    if (n === 0) return
    if (n > 0) {
      if (freeNow(buildings) < n) return
      claimed.current += n
    }
    setPopulation((p) => {
      // The same check again, against the state as it really is. A check made against the
      // render snapshot is not an invariant — this codebase already shipped a unit into two
      // legions that way. Refuses in silence: the button was disabled with the reason on it,
      // and a setState updater must not call another setState to log.
      if (assignBlocker(b, n, p, buildings)) return p
      const next = handsAt(p, b) + n
      const at = { ...p.at }
      if (next > 0) at[b.id] = next
      else delete at[b.id]
      return { ...p, at }
    })
  }

  /**
   * What the day just simulated did to the town: newcomers, and a day of work on the record
   * of every crew that earned one. Committed here rather than inside `simulateEconomyDay`
   * so an offline catch-up — which runs the day once per caught-up day — credits each of
   * those days exactly once, the same shape as the duty block.
   */
  function applyDay(grown: number, workedBuildingIds: string[] = []): void {
    const born = Math.max(0, Math.floor(grown || 0))
    if (born <= 0 && workedBuildingIds.length === 0) return
    setPopulation((p) => {
      const work = { ...(p.work ?? {}) }
      for (const id of workedBuildingIds) work[id] = (work[id] ?? 0) + 1
      return { ...p, souls: p.souls + born, work }
    })
  }

  /** Load / reset. The only wholesale write, and it goes through hydration first. */
  function replace(next: PopulationState): void {
    claimed.current = 0
    setPopulation(next)
  }

  return { population, freeNow, conscript, assign, applyDay, replace }
}
