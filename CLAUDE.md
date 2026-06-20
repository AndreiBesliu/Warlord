# CLAUDE.md — Warlord

## Ce este Warlord
Joc de strategie browser-based în React/TypeScript unde jucătorul gestionează un domeniu medieval: construiește clădiri, extrage resurse, produce echipament, recrutează și antrenează unități militare, și conduce campanii de luptă. Jocul rulează complet în browser, fără backend — starea e salvată în localStorage.

## Principiile jocului (permanente — nu se încalcă fără decizia explicită a lui Andrei)
1. **Single-player, offline-first:** niciun backend, niciun cont, totul în localStorage.
2. **Complexitate progresivă:** fiecare feature nou trebuie să adauge o decizie semnificativă pentru jucător, nu doar un number to click.
3. **Economy loop coerent:** resurse → producție → echipament → unități → luptă → recompense → resurse. Orice feature trebuie să se integreze în acest loop.
4. **Moddable:** sistemul de Registry permite adăugarea de iteme/unități prin mods fără a modifica core-ul.
5. **TypeScript strict:** nicio linie de `as any` nouă fără justificare. Build-ul TS trebuie să fie verde după fiecare task.

## Fapte stabile (infra)
- **Stack:** React 18 + TypeScript + Vite + Tailwind CSS
- **State:** hooks custom (useGameState, useEconomy, useBarracks, useUnits) — fără Redux/Zustand
- **Persistență:** localStorage (`warlord_save`)
- **Moddare:** `src/logic/registry.ts` — GameRegistry singleton
- **Path local:** `c:\Users\besli\Desktop\games\warlord`
- **Dev server:** `npm run dev` (port 5173)
- **Build:** `npm run build`
- **Type check:** `npx tsc --noEmit`

## Reguli de lucru (hard)
- **Sync workflow:** după FIECARE task: `npx tsc --noEmit` verde → `npm run build` verde → intrare în DEVLOG.md → commit → push
- **DEVLOG.md** (append-only): Task Started + Task Completed cu timestamp, prompt exact, model
- **Plan mode** pentru orice feature care atinge mai mult de 2 fișiere
- **Nu modifica nimic în `c:\Users\besli\Desktop\MyWork\Apps\`** — e doar pentru referință și context
- **Fiecare feature nou** trebuie documentat în DEVLOG sub Roadmap înainte de implementare
- **Save/load** — orice state nou adăugat pe `Unit`, `Building`, sau `ResourceMap` trebuie inclus în `useGameState.tsx` la save și la load
- **Nu adăuga comentarii** care explică CE face codul — doar WHY când e non-obvious

## Comenzi
```bash
npm run dev          # dev server
npm run build        # build producție
npx tsc --noEmit     # type check fără emit
npm run preview      # preview build
```

## Arhitectură (hartă scurtă)
```
src/
  logic/          # logică pură (fără React)
    types.ts      # tipuri globale + constante
    economy.ts    # costuri clădiri, producție pasivă
    units.ts      # computeReady, split, merge
    items.ts      # prețuri items via Registry
    equipment.ts  # demand + ensureEquipOrBuy
    training.ts   # queueLightTraining, conversii
    batches.ts    # TrainingBatch, slot/duration formule
    registry.ts   # GameRegistry singleton (items + units)
  state/          # React state hooks
    useGameState.tsx  # hook principal, exportă tot ce au tab-urile
    useEconomy.ts     # wallet, inv, buildings, resources
    useBarracks.ts    # barracks pool, recruits, batches
    useUnits.ts       # lista de unități active
  components/
    tabs/         # tab-uri principale (Overview, Buildings, Market, Barracks, Units, Resources, Log)
    barracks/     # forms pentru recrutare/conversie
    buildings/    # ProductionModal
    common/       # Card, GameIcon, MarketPanel, MoneyDisplay, InvSummary
    units/        # MissingEquipment, ReplenishForm, SplitMergeControls
  mods/           # exemplu mod (sampleMod.ts)
  assets/         # imagini PNG pentru clădiri, iconițe, scene
```

## Capcane cunoscute
- **horses în `equip`** sunt `{ active: number, inactive: number }`, nu scalari — orice split/merge trebuie să respecte structura
- **setState callbacks** nu apelează alte setState — verificările se fac ÎNAINTE de setState
- **`econ.resources`** trebuie inclus în dependency array-ul useEffect din useGameState pentru ca save-ul să se triggere
- **Registry** se inițializează o singură dată (guard `initialized`) — mods se înregistrează după `Registry.init()`
- **batchSlots formula:** `Math.min(level + 1, 5)` — level 4 atinge maximul de 5 sloturi
