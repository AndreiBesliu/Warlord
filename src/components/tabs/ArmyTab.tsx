import Card from '../common/Card'
import BarracksTab from './BarracksTab'
import UnitsTab from './UnitsTab'
import CampaignTab from './CampaignTab'
import type { GameStateShape } from '../../state/useGameState'
import barracksScene from '../../assets/barracks_scene.png'
import armyCampScene from '../../assets/army_camp_scene.png'

// Raising, training, forming and fighting an army used to be three separate tabs, each
// hiding its screens behind a picture with invisible rectangles on it. Getting from
// "train a batch" to "form a unit" cost four clicks and threw away everything you had
// typed, because leaving a tab unmounted it.
//
// One tab, five sections, sub-navigation always on screen. The art stays — as a banner
// that follows the section, not as the door you have to find.

export type ArmySection = 'RECRUIT' | 'TRAIN' | 'FORM' | 'INSPECT' | 'CAMPAIGN'

const SECTIONS: { id: ArmySection; label: string; icon: string; hint: string }[] = [
  { id: 'RECRUIT', label: 'Recruit', icon: '📜', hint: 'Take on untyped recruits' },
  { id: 'TRAIN', label: 'Train', icon: '⚔️', hint: 'Turn recruits into soldiers' },
  { id: 'FORM', label: 'Form', icon: '⛺', hint: 'Assemble soldiers into units' },
  { id: 'INSPECT', label: 'Inspect', icon: '🛡️', hint: 'Your standing army' },
  { id: 'CAMPAIGN', label: 'Campaign', icon: '🗺️', hint: 'March out and fight' },
]

const BANNER: Record<ArmySection, string | null> = {
  RECRUIT: barracksScene,
  TRAIN: barracksScene,
  FORM: armyCampScene,
  INSPECT: armyCampScene,
  CAMPAIGN: null, // the battle grid wants the width more than the art does
}

export default function ArmyTab({
  state, section, onSection,
}: {
  state: GameStateShape
  section: ArmySection
  onSection: (s: ArmySection) => void
}) {
  // A battle needs room and undivided attention: the banner collapses while one is on,
  // but the sub-nav stays so you are never trapped in the screen.
  const inBattle = !!state.campaign?.battle
  const banner = inBattle ? null : BANNER[section]

  return (
    <Card title="Army">
      <nav className="flex flex-nowrap overflow-x-auto sm:flex-wrap items-center gap-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((s) => {
          const active = s.id === section
          return (
            <button
              key={s.id}
              onClick={() => onSection(s.id)}
              title={s.hint}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 px-3 py-2 min-h-[38px] rounded-lg border text-sm font-serif transition-colors ${
                active
                  ? 'bg-wl-accent text-wl-accent-ink border-wl-accent font-bold'
                  : 'bg-wl-panel border-wl-line text-wl-ink hover:bg-wl-panel-muted'
              }`}
            >
              <span aria-hidden className="mr-1.5">{s.icon}</span>{s.label}
            </button>
          )
        })}
      </nav>

      {banner && (
        <div className="mt-3 relative w-full h-24 sm:h-32 rounded-lg overflow-hidden border border-wl-line bg-wl-panel-contrast">
          {/* Keyed so React swaps the element and the fade actually runs. */}
          <img
            key={banner}
            src={banner}
            alt=""
            aria-hidden
            draggable={false}
            className="wl-scene w-full h-full object-cover wl-fade"
          />
          <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-1.5">
            <span className="text-white text-sm font-serif">
              {SECTIONS.find((s) => s.id === section)?.hint}
            </span>
          </div>
        </div>
      )}

      {/* All five stay MOUNTED and the inactive ones are hidden, so a quantity you typed
          is still there when you come back — unmounting is exactly what used to throw it
          away. `display:none → block` re-runs a CSS animation, so hiding buys the entrance
          fade for free, with no remount. */}
      <div className="mt-4">
        <div className={section === 'RECRUIT' ? 'wl-fade' : 'hidden'}>
          <BarracksTab state={state} view="RECRUIT" />
        </div>
        <div className={section === 'TRAIN' ? 'wl-fade' : 'hidden'}>
          <BarracksTab state={state} view="TRAINING" />
        </div>
        <div className={section === 'FORM' ? 'wl-fade' : 'hidden'}>
          <UnitsTab state={state} view="FORMATION" />
        </div>
        <div className={section === 'INSPECT' ? 'wl-fade' : 'hidden'}>
          <UnitsTab state={state} view="INSPECTION" />
        </div>
        <div className={section === 'CAMPAIGN' ? 'wl-fade' : 'hidden'}>
          <CampaignTab state={state} />
        </div>
      </div>
    </Card>
  )
}
