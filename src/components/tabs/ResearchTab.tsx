import Card from '../common/Card'
import CostList from '../common/CostList'
import type { GameStateShape } from '../../state/useGameState'
import type { Branch, Modifiers } from '../../logic/research/effects'
import { BRANCH_LABEL, prereqsMet, missingBuildings, techById, type TechDef } from '../../logic/research/catalog'
import { evaluateCost } from '../../logic/costs'

const BRANCHES: Branch[] = ['ECONOMY', 'ARMY', 'CAMPAIGN', 'UNLOCKS']

const BRANCH_STYLE: Record<Branch, string> = {
  ECONOMY: 'bg-wl-economy-surface border-wl-economy',
  ARMY: 'bg-wl-army-surface border-wl-army',
  CAMPAIGN: 'bg-wl-campaign-surface border-wl-campaign',
  UNLOCKS: 'bg-wl-doctrine-surface border-wl-doctrine',
}

const BRANCH_HEAD: Record<Branch, string> = {
  ECONOMY: 'text-wl-economy',
  ARMY: 'text-wl-army',
  CAMPAIGN: 'text-wl-campaign',
  UNLOCKS: 'text-wl-doctrine',
}

// Human-readable summary of the aggregated modifiers — so the player can always see
// exactly what their research + momentum is worth right now.
function effectLines(m: Modifiers): string[] {
  const out: string[] = []
  const pct = (v: number) => `${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`
  if (m.prodMult !== 1) out.push(`Production ${pct(m.prodMult)}`)
  if (m.craftEfficiency !== 1) out.push(`Crafting ${pct(m.craftEfficiency)}`)
  if (m.buildCostMult !== 1) out.push(`Build cost ${pct(m.buildCostMult)}`)
  if (m.upkeepMult !== 1) out.push(`Upkeep ${pct(m.upkeepMult)}`)
  if (m.foodMult !== 1) out.push(`Food use ${pct(m.foodMult)}`)
  if (m.trainXpMult !== 1) out.push(`Training XP ${pct(m.trainXpMult)}`)
  if (m.trainDaysDelta !== 0) out.push(`Training ${m.trainDaysDelta}d`)
  if (m.trainSlotsDelta !== 0) out.push(`+${m.trainSlotsDelta} training slot${m.trainSlotsDelta > 1 ? 's' : ''}`)
  if (m.lootMult !== 1) out.push(`Battle loot ${pct(m.lootMult)}`)
  if (m.postBattleMoraleBonus !== 0) out.push(`Post-battle morale +${m.postBattleMoraleBonus}`)
  return out
}

export default function ResearchTab({ state }: { state: GameStateShape }) {
  const { research, mods, catalog, startResearch, wallet, resources, buildings } = state
  const inProgress = new Map(research.queue.map((p) => [p.id, p]))

  // One evaluation per tech: the SAME object drives the price row, the button label and
  // the disabled state, so the card can never claim one thing and the button another.
  const priceOf = (t: TechDef) =>
    evaluateCost({ copper: t.costCopper, resources: t.costResources }, { wallet, resources })

  const effects = effectLines(mods)

  return (
    <div className="space-y-4">
      {/* Momentum — the cross-branch effects. Front and centre so they're felt. */}
      <Card title="Momentum & Standing">
        <div className="space-y-3">
          {research.buffs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {research.buffs.map((b) => (
                <div
                  key={b.id}
                  title={b.desc}
                  className={`px-3 py-2 rounded-lg border text-sm ${b.good ? 'bg-wl-good-surface border-wl-good' : 'bg-wl-bad-surface border-wl-bad'}`}
                >
                  <div className="font-semibold">{b.good ? '🔥' : '🩸'} {b.name}</div>
                  <div className="text-xs text-wl-muted">{b.daysRemaining}d left</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-wl-muted">
              No active momentum. Win a battle or finish a research project — victories lift
              your workshops and your soldiers in training for a few days.
            </p>
          )}

          <div className="border-t border-wl-line pt-2">
            <div className="text-xs uppercase tracking-wide text-wl-muted mb-1">Total effect</div>
            {effects.length === 0 ? (
              <span className="text-sm text-wl-muted">Nothing researched yet.</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {effects.map((e) => (
                  <span key={e} className="text-xs font-mono px-2 py-1 rounded bg-wl-panel-muted border border-wl-line">{e}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BRANCHES.map((branch) => (
          <div key={branch} className="space-y-2">
            <h3 className={`font-serif text-lg font-bold ${BRANCH_HEAD[branch]}`}>{BRANCH_LABEL[branch]}</h3>
            {catalog
              .filter((t) => t.branch === branch)
              .sort((a, b) => a.tier - b.tier)
              .map((t) => {
                const done = research.unlocked.includes(t.id)
                const busy = inProgress.get(t.id)
                const missingB = missingBuildings(t, buildings ?? [])
                const ready = prereqsMet(t, research.unlocked) && missingB.length === 0
                const price = priceOf(t)
                const missingReq = t.requires
                  .filter((r) => !research.unlocked.includes(r))
                  .map((r) => techById(catalog, r)?.name ?? r)

                return (
                  <div
                    key={t.id}
                    className={`border rounded-lg p-3 ${done ? 'bg-wl-good-surface border-wl-good' : busy ? 'bg-wl-warn-surface border-wl-warn' : ready ? BRANCH_STYLE[branch] : 'bg-wl-panel-muted border-wl-line opacity-70'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm">
                        {done ? '✔ ' : busy ? '⏳ ' : !ready ? '🔒 ' : ''}{t.name}
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-wl-panel/70 border border-wl-line font-mono">T{t.tier}</span>
                    </div>
                    <p className="text-xs text-wl-muted mt-1 min-h-[32px]">{t.desc}</p>

                    {done && <div className="text-xs text-wl-good font-semibold">Researched</div>}

                    {busy && (
                      <div className="text-xs text-wl-warn font-semibold">
                        In progress — {busy.daysRemaining} day{busy.daysRemaining > 1 ? 's' : ''} left
                      </div>
                    )}

                    {!done && !busy && (
                      <>
                        <div className="mt-1 space-y-1">
                          <CostList lines={price.lines} />
                          <div className="text-[11px] text-wl-subtle">Takes {t.days} day{t.days === 1 ? '' : 's'}</div>
                        </div>
                        {!ready ? (
                          <div className="text-xs text-wl-muted mt-1">
                            {missingReq.length > 0 && <div>Requires: {missingReq.join(', ')}</div>}
                            {missingB.length > 0 && <div>Needs: {missingB.join(', ')}</div>}
                          </div>
                        ) : (
                          <button
                            onClick={() => startResearch(t.id)}
                            disabled={!price.ok}
                            className={`mt-2 w-full px-3 py-2 min-h-[36px] rounded text-sm ${price.ok ? 'bg-wl-accent text-wl-accent-ink hover:bg-wl-accent/90' : 'bg-wl-panel-muted text-wl-subtle cursor-not-allowed'}`}
                          >
                            {price.ok ? 'Research 🔬' : price.shortfallLabel}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-wl-muted italic">
        Research improves your domain — production, training, supply and campaign spoils.
        Battles are always fought on even stats; a stronger economy simply fields a better army.
      </div>
    </div>
  )
}
