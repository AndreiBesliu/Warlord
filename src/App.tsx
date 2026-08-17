// src/App.tsx
import './styles/tokens.css'
import { useEffect, useRef, useState } from 'react'
import BuildingsTab from './components/tabs/BuildingsTab'
import ResourcesTab from './components/tabs/ResourcesTab'
import MarketTab from './components/tabs/MarketTab'
import OverviewTab from './components/tabs/OverviewTab'
import LogTab from './components/tabs/LogTab'
import ResearchTab from './components/tabs/ResearchTab'

import ArmyTab, { type ArmySection } from './components/tabs/ArmyTab'
import ResourceBar from './components/common/ResourceBar'
import { useGameState } from './state/useGameState'
import { STALE_BUILD_MESSAGE } from './logic/saveSchema'
import { GameConfig } from './logic/config'
import { planTicks, mmss, humanDuration } from './logic/tick'
import type { GameConfigOverrides } from './logic/config'


// saveKey scopes ALL persistence (game save + tick timers). The OurDaysApp embed passes
// a per-user key (warlord_save_<uid>) so users on one device don't share saves, and may
// pass initialBlob/onPersist to back the save with the cloud instead of localStorage.
export default function App({
  saveKey = 'warlord_save',
  initialBlob,
  onPersist,
  config,
  theme,
}: {
  saveKey?: string
  initialBlob?: any
  onPersist?: (blob: any) => void
  config?: GameConfigOverrides | null // admin-tuned balance (absent = built-in defaults)
  // A host that has its own light/dark setting passes it here and the game follows it.
  // Omitted (standalone, or a host with no opinion) → the game keeps its own toggle.
  theme?: 'light' | 'dark'
}) {
  const state = useGameState(saveKey, { initialBlob, onPersist, config })

  // Colour is decided ONCE, by tokens on the `.warlord` root (src/styles/tokens.css).
  // Components never name a palette colour, so there is no second set of dark values
  // to keep in step — which is why the game had no dark mode for so long.
  const [selfDark, setSelfDark] = useState<boolean>(
    () => localStorage.getItem(`${saveKey}:dark`) === 'true'
  )
  const dark = theme ? theme === 'dark' : selfDark
  useEffect(() => {
    if (!theme) localStorage.setItem(`${saveKey}:dark`, String(selfDark))
  }, [saveKey, selfDark, theme])

  // ---- day clock ----
  // Every day is derived from `state.lastTickAt` (the timestamp of the last completed
  // day, stored IN THE SAVE). Nothing is scheduled against an in-memory deadline any
  // more: closing the app used to discard the elapsed window and restart the countdown,
  // so time spent away credited zero days and short visits never advanced a day at all.
  const TICK_MS = GameConfig.tickMs();
  const MAX_OFFLINE_DAYS = GameConfig.tick().maxOfflineDays;

  const [autoTick, setAutoTick] = useState<boolean>(() => {
    const v = localStorage.getItem(`${saveKey}:autoTick`);
    return v ? v === 'true' : true; // default ON
  });
  const [remaining, setRemaining] = useState<number>(
    () => planTicks(Date.now(), state.lastTickAt, TICK_MS, MAX_OFFLINE_DAYS).remainingMs
  );
  // Days still owed to the player, drained one per commit (see below).
  const [pendingDays, setPendingDays] = useState(0);

  useEffect(() => {
    localStorage.setItem(`${saveKey}:autoTick`, String(autoTick));
  }, [saveKey, autoTick]);

  // The heartbeat reads the game through a ref so the interval is installed ONCE.
  // `state` is a fresh object every render, so keeping it in the dependency array
  // tore down and re-created the interval on every single render.
  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingRef = useRef(pendingDays);
  pendingRef.current = pendingDays;
  // The anchor a backlog was last planned from. Guards against crediting the same
  // absence twice when the effect runs more than once for one mount (StrictMode).
  const plannedFromRef = useRef(0);

  useEffect(() => {
    if (!autoTick) return;

    const check = () => {
      const g = stateRef.current;
      const plan = planTicks(Date.now(), g.lastTickAt, TICK_MS, MAX_OFFLINE_DAYS);
      setRemaining(plan.remainingMs);
      if (pendingRef.current > 0) return; // a drain is in flight — never touch the anchor
      if (plan.grant <= 0) {
        // A clock that ran backwards (device time change, sleep/resume) leaves the
        // anchor in the future; rebase it so the countdown can't stick at a nonsense value.
        if (plan.anchor !== g.lastTickAt) g.setLastTickAt(plan.anchor);
        return;
      }
      if (plan.anchor === plannedFromRef.current) return; // already planned this window
      plannedFromRef.current = plan.anchor;
      if (plan.due > 1) {
        const away = humanDuration(plan.due * TICK_MS);
        g.addLog(
          plan.forfeited > 0
            ? `⏳ Away ${away} — resolving ${plan.grant} days (${plan.forfeited} beyond the ${MAX_OFFLINE_DAYS}-day catch-up limit were skipped).`
            : `⏳ Away ${away} — resolving ${plan.grant} days.`
        );
      }
      // Rewind the anchor so the days about to run land it exactly on now-minus-remainder.
      g.setLastTickAt(plan.anchor);
      setPendingDays(plan.grant);
    };

    check(); // credit an absence immediately on mount, before the first interval fires
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [autoTick, TICK_MS, MAX_OFFLINE_DAYS]);

  // Drain the backlog ONE DAY PER COMMIT. runDailyTick reads the render snapshot
  // (`const nextDay = day + 1`, `for (const u of unit.units)`, ...), so calling it N
  // times in a row from one closure would compute every day from the same stale state
  // and advance the day by exactly 1.
  useEffect(() => {
    if (pendingDays <= 0) return;
    state.runDailyTick();
    setPendingDays(n => n - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDays]);

  // Manual “run now” also restarts the countdown from this instant.
  function runDayNow() {
    state.runDailyTick(Date.now());
    setRemaining(TICK_MS);
  }

  const {
    day, wallet,
    loadSave, resetAll,
  } = state

  const [tab, setTab] = useState<'overview' | 'resources' | 'buildings' | 'army' | 'market' | 'research' | 'log'>('overview')
  // The army section lives up here, not inside the tab: mounting is conditional, so a walk
  // through Overview and back used to reset it — along with everything typed underneath.
  const [armySection, setArmySection] = useState<ArmySection>('RECRUIT')

  return (
    <div className={`warlord${dark ? ' dark' : ''} min-h-screen p-3 sm:p-6 space-y-4`}>
      <div className="max-w-6xl mx-auto space-y-4">
      {/* Above everything, and not dismissible: the game still plays but nothing is being
          written. A message in the Log would be the worst possible place for this. */}
      {state.staleBuild && (
        <div role="alert" className="rounded-lg border border-wl-bad/60 bg-wl-bad-surface p-3 text-sm text-wl-ink">
          <strong className="font-serif">Not saving.</strong> {STALE_BUILD_MESSAGE}
        </div>
      )}
      {/* Two wrapping rows. The controls used to live in a nested `ml-auto` flex that
          could not shrink: ~460px of buttons in a 375px viewport, so every screen in the
          game scrolled sideways. Identity + day on one line, the clock and its actions on
          the next, destructive actions last and separated. */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-wl-ink">Warlord</h1>
        {/* The day is the number a player checks constantly; the title is a word that never
            changes. Sizing them the other way round made the masthead the loudest thing on
            screen and the actual state the quietest. */}
        <div className="ml-auto flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wide text-wl-muted">Day</span>
          <span className="px-2 py-0.5 bg-wl-panel-muted text-wl-ink rounded font-mono text-2xl sm:text-3xl font-bold leading-tight">{day}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-wl-muted">
          Next day in <span className="font-mono">{mmss(remaining)}</span>
        </span>
        <button
          className="px-3 py-2 border border-wl-line bg-wl-panel text-wl-ink rounded hover:bg-wl-panel-muted"
          onClick={() => setAutoTick(a => !a)}
        >
          {autoTick ? 'Pause Auto' : 'Resume Auto'}
        </button>
        <button
          className="px-3 py-2 bg-wl-accent text-wl-accent-ink rounded font-semibold hover:opacity-90"
          onClick={runDayNow}
        >
          Run Day ▶
        </button>
        {!theme && (
          <button
            className="px-3 py-2 border border-wl-line bg-wl-panel text-wl-ink rounded hover:bg-wl-panel-muted"
            onClick={() => setSelfDark(d => !d)}
            title={dark ? 'Switch to light' : 'Switch to dark'}
          >
            {dark ? '☀' : '☾'}
          </button>
        )}

        <span className="ml-auto flex items-center gap-2">
          <button className="px-3 py-2 border border-wl-line bg-wl-panel text-wl-ink rounded hover:bg-wl-panel-muted" onClick={loadSave}>Load</button>
          {/* Reset wipes the kingdom. It used to sit flush against Load with no
              confirmation — one mis-click on day 159 and everything was gone. */}
          <button
            className="px-3 py-2 border border-wl-bad/50 text-wl-bad rounded hover:bg-wl-bad-surface"
            title="Delete this kingdom and start over"
            onClick={() => {
              if (confirm(`Reset the kingdom? Day ${day}, and everything you have built, is deleted. This cannot be undone.`)) resetAll()
            }}
          >
            Reset
          </button>
        </span>
      </div>

      {/* Stores and what tomorrow does to them — visible from every tab, so a change to a
          building's focus can be judged without hunting through screens. */}
      <ResourceBar
        wallet={wallet}
        resources={state.resources}
        inv={state.inv}
        buildings={state.buildings}
        units={state.units}
        mods={state.mods}
        population={state.population}
      />

      {/* Nine equal pills in one row gave no map of the game. Grouped by what you are
          actually doing — run the domain, run the army, look things up — with proximity
          doing the work instead of extra chrome. Icons make each one findable at a glance,
          which matters most on a phone where the row wraps. */}
      {/* On a phone the wrapped rows ate 172px — a fifth of the screen for navigation.
          One swipeable band instead; the labels stay, which icon-only would have cost. */}
      <nav className="flex flex-nowrap overflow-x-auto sm:flex-wrap items-center gap-x-5 gap-y-2 -mx-3 px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          ['Domain', [['overview', 'Overview', '\u{1F3F0}'], ['resources', 'Resources', '\u{1F4E6}'], ['buildings', 'Buildings', '\u{1F3D7}'], ['market', 'Market', '\u2696']]],
          ['Army', [['army', 'Army', '⚔']]],
          ['Records', [
            ...(state.hasResearchBuilding ? [['research', 'Research', '\u{1F52C}'] as const] : []),
            ['log', 'Log', '\u{1F4DC}'] as const,
          ]],
        ] as const).map(([groupName, items], gi) => (
          <div key={groupName} className="flex flex-nowrap sm:flex-wrap items-center gap-1 shrink-0">
            {gi > 0 && <span aria-hidden className="hidden sm:block w-px h-6 bg-wl-line mr-4" />}
            {items.map(([k, label, icon]) => (
              <button
                key={k}
                onClick={() => setTab(k as any)}
                title={`${groupName}: ${label}`}
                className={`px-3 py-1.5 min-h-[36px] whitespace-nowrap shrink-0 rounded border transition-colors ${
                  tab === k
                    ? 'bg-wl-accent text-wl-accent-ink border-wl-accent font-semibold'
                    : 'bg-wl-panel text-wl-ink border-wl-line hover:bg-wl-panel-muted'
                }`}
              >
                <span aria-hidden className="mr-1">{icon}</span>{label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {tab === 'overview' && <OverviewTab state={state} />}

      {tab === 'resources' && <ResourcesTab resources={state.resources} />}

      {tab === 'buildings' && <BuildingsTab state={state} setTab={setTab as any} />}

      {tab === 'army' && <ArmyTab state={state} section={armySection} onSection={setArmySection} />}


      {tab === 'market' && <MarketTab state={state} />}

      {tab === 'research' && <ResearchTab state={state} />}


      {tab === 'log' && <LogTab state={state} />}

      </div>
    </div>
  )
}
