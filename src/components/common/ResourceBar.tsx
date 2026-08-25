import { forecastDay, explainResource } from '../../logic/forecast'
import { ResourceTypes, fmtCopper, type Building, type Inventories, type ResourceMap, type ResourceType, type Unit } from '../../logic/types'
import { formatGameTooltip, getIconForGameItem } from '../../logic/iconHelpers'
import GameIcon from './GameIcon'
import { BRANCHES } from '../../logic/research/study'
import { BRANCH_LABEL } from '../../logic/research/catalog'
import { idleHands, totalCrewPosts, type PopulationState } from '../../logic/population'

type Props = {
  wallet: number
  resources: ResourceMap
  inv: Inventories
  buildings: Building[]
  units: Unit[]
  mods?: { prodMult?: number; craftEfficiency?: number; upkeepMult?: number; foodMult?: number }
  population?: PopulationState
}

// Always shown even at zero: these three decide whether the domain lives or starves.
const ALWAYS: ResourceType[] = ['FOOD', 'WOOD', 'STONE']

function Delta({ n }: { n: number }) {
  // `subtle` is 2.9:1 against bad-surface — and the starving chip is the one you must read.
  if (n === 0) return <span className="text-wl-muted font-mono text-[11px]">±0</span>
  return (
    <span className={`font-mono text-[11px] ${n > 0 ? 'text-wl-good' : 'text-wl-bad'}`}>
      {n > 0 ? '+' : ''}{n}
    </span>
  )
}

export default function ResourceBar({ wallet, resources, inv, buildings, units, mods, population }: Props) {
  // Recomputed every render on purpose. It is one pass over a handful of buildings, and
  // memoising on `inv` would be WRONG: queueLightTraining mutates the inventory object in
  // place, so its identity does not change when equipment is spent.
  const f = forecastDay({ buildings, resources, inv, units, mods, population })

  const idle = population ? idleHands(population, buildings) : 0
  const posts = population ? totalCrewPosts(buildings) : 0
  const posted = Math.max(0, (population?.souls ?? 0) - idle)

  const studyTotal = BRANCHES.reduce((sum, br) => sum + (f.studyByBranch[br] ?? 0), 0)

  const shown = ResourceTypes.filter(
    (r) => ALWAYS.includes(r) || (resources[r] ?? 0) > 0 || f.resourceDelta[r] !== 0,
  )

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-wl-accent-surface border border-wl-accent-line"
        title={
          `Buildings and minting: ${fmtCopper(f.incomeWalletDelta)}/day\n` +
          `Soldier upkeep: −${fmtCopper(f.soldierUpkeep)}/day` +
          (f.walletDelta < 0 && wallet + f.walletDelta < 0 ? '\n⚠ The treasury goes negative tomorrow' : '')
        }
      >
        <GameIcon name="gold" size={16} />
        <span className="font-mono">{fmtCopper(wallet)}</span>
        <Delta n={f.walletDelta} />
      </span>

      {/* Souls sit next to coin for the same reason study does: posting hands is a lever,
          and a lever with no gauge is not a decision. The growth line reads from the SAME
          forecast the resource chips do, so the chip and the granary cannot disagree. */}
      {population && (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-wl-panel border border-wl-line"
          title={
            `${population.souls} souls in the domain\n`
            + `${idle} idle · ${posted} posted of ${posts} post${posts === 1 ? '' : 's'} the buildings offer\n`
            + (f.peopleGrown > 0
              ? `+${f.peopleGrown} tomorrow, eating ${f.peopleFoodSpent} of today's harvest`
              : `Nobody tomorrow — ${f.growthBlocked ?? 'no farm'}`)
            + '\nOnly food grown TODAY makes people; a bought granary feeds soldiers, not children.'
            + '\nRecruiting takes them out of this pool for good.'
          }
        >
          <span aria-hidden>👥</span>
          <span className="font-mono text-wl-ink">{population.souls}</span>
          {/* Visible, not in the `title`: this ships inside a Capacitor app, where a tooltip
              never fires at all, and the unused posts are the whole reason to open a building. */}
          <span className="text-wl-muted text-[11px]">{idle} idle</span>
          {posts > 0 && posted < posts && (
            <span className="text-[11px] text-wl-warn" title={`${posts - posted} posts stand empty — a full crew works its house at up to ×2 the day`}>
              {posted}/{posts} posted
            </span>
          )}
          <Delta n={f.peopleGrown} />
        </span>
      )}

      {/* Study is the third thing a building's day can become, so it belongs in the same
          bar as coin and goods — otherwise the Research% slider is a lever with no gauge. */}
      {studyTotal > 0 && (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-wl-panel border border-wl-line"
          title={
            'Study produced per day\n' +
            BRANCHES.map((br) => `${BRANCH_LABEL[br]}: +${f.studyByBranch[br]}`).join('\n')
          }
        >
          <span aria-hidden>🔬</span>
          <span className="font-mono text-wl-ink">{Math.round(studyTotal * 10) / 10}</span>
          <span className="text-wl-muted text-[11px]">study/day</span>
        </span>
      )}

      {shown.map((r) => {
        const stock = resources[r] ?? 0
        const delta = f.resourceDelta[r]
        const empties = f.daysToEmpty[r]
        const starving = r === 'FOOD' && f.foodShortage
        const why = explainResource(f, r)
        return (
          <span
            key={r}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${
              starving ? 'bg-wl-bad-surface border-wl-bad' : 'bg-wl-panel border-wl-line'
            }`}
            title={
              `${formatGameTooltip(r)}\n` +
              (why.length ? why.join('\n') + '\n' : '') +
              (empties !== undefined ? `Empty in ${empties} day${empties === 1 ? '' : 's'}\n` : '') +
              (starving ? '⚠ Not enough food — morale is falling' : '')
            }
          >
            <GameIcon name={getIconForGameItem(r) || 'wood'} size={16} />
            <span className="font-mono">{stock}</span>
            <Delta n={delta} />
          </span>
        )
      })}

      {f.blocked.length > 0 && (
        <span
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-wl-warn-surface border border-wl-warn text-[11px] text-wl-warn"
          title={f.blocked
            .map((l) => `${l.type} wants ${l.itemsWanted} ${l.outputItem} but has no inputs — the output is lost, not stored`)
            .join('\n')}
        >
          {/* NOT "idle": the souls chip in this same bar already uses that word for unposted
              people. Two meanings, one bar, three centimetres apart. */}
          ⚠ {f.blocked.length} starved
        </span>
      )}
    </div>
  )
}
