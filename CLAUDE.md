# CLAUDE.md — Warlord

## Ce este Warlord
Joc de strategie browser-based în React/TypeScript unde jucătorul gestionează un domeniu medieval: construiește clădiri, extrage resurse, produce echipament, recrutează și antrenează unități militare, și conduce campanii de luptă. Jocul rulează complet în browser, fără backend — starea e salvată în localStorage.

## Principiile jocului (permanente — nu se încalcă fără decizia explicită a lui Andrei)
1. **Single-player, offline-first:** niciun backend, niciun cont, totul în localStorage.
2. **Complexitate progresivă:** fiecare feature nou trebuie să adauge o decizie semnificativă pentru jucător, nu doar un number to click.
3. **Economy loop coerent:** resurse → producție → echipament → unități → luptă → recompense → resurse. Orice feature trebuie să se integreze în acest loop.
4. **Moddable:** sistemul de Registry permite adăugarea de iteme/unități prin mods fără a modifica core-ul.
5. **TypeScript strict:** nicio linie de `as any` nouă fără justificare. Build-ul TS trebuie să fie verde după fiecare task.

## ⚠️ PvP server-authoritative (LIVE)
PvP-ul între membrii unui grup rulează pe server: Cloud Functions în `Apps/OurDaysApp/functions/src/index.ts` (acceptWarlordChallenge / submitWarlordCommand / forfeitWarlordBattle / onWarlordBattleUpdated) rulează ACELAȘI motor pur. **Singura copie rămasă a motorului** (submodulul a eliminat-o pe cealaltă): `logic/combat/{types,rng,stats,engine,pvp}.ts` există **byte-identic** și în `Apps/OurDaysApp/functions/src/warlordCombat/`, pentru că funcțiile server rulează pe alt runtime și alt tsconfig. **`logic/types.ts` NU e byte-identic și nu trebuie să fie** — a divergat de la felia de research încoace (SCRIPTORIUM, `focusResearchPct`, `RecruitPool`) fără nicio consecință. Contractul real e că serverul importă din el exact **7 simboluri**: `SoldierType`, `SoldierTypes`, `Rank`, `Ranks`, `RankNumber`, `UnitBucket`, `Weapon`. Doar alea trebuie să rămână identice. `Unit` e declarat în copia server dar nu-l importă nimic acolo — de-aia legiunile n-au cerut niciun deploy de functions. (Regula veche „types.ts byte-identic" era falsă și toată lumea o știa falsă, ceea ce e mai rău decât nicio regulă: nu puteai distinge zgomotul de semnal la un `diff`.) Orice modificare la aceste fișiere se aplică în AMBELE locuri (verifică: `git diff --no-index <a> <b>`), apoi `firebase deploy --only functions`. Regulile Firestore (`firestore.rules`, blocul games) au fence pe `gameType == 'warlord-battle'` — câmpurile server-owned nu pot fi scrise de client. UI-ul PvP e OurDaysApp-only (`src/warlordPvp/`), NU face parte din codul sincronizat.

## ⚠️ Cum ajunge jocul în OurDaysApp (SUBMODUL, nu copie)
Warlord e un **produs propriu, cu repo propriu** — poate fi distribuit și prin alte canale,
nu doar prin OurDaysApp. În același timp, jocul și aplicația trebuie să meargă împreună pe live.

Din 2026-08-02 mecanismul e un **submodul git**: `OurDaysApp/src/warlord` **nu mai e o copie**,
e un pointer către un commit din repo-ul ăsta. Nu mai există două copii de ținut identice —
divergența a devenit imposibilă prin construcție. (Până atunci, codul era copiat fișier cu
fișier și verificat cu `diff -q`; regula aceea nu mai există — dacă o găsești scrisă undeva,
e depășită.)

**Consecință pentru fluxul de lucru:** o modificare în joc cere DOUĂ commit-uri.
1. Aici: commit + push în repo-ul Warlord.
2. În OurDaysApp: `git -C src/warlord pull` (sau `git submodule update --remote`), apoi
   commit care urcă pointerul + push. Fără pasul 2, live-ul rămâne pe versiunea veche.

Aplicația importă jocul prin aliasul `@warlord/*` (→ `src/warlord/src/*`, definit în
`vite.config.ts` + `tsconfig.app.json`), ca să nu depindă de structura internă a submodulului.
`vite.config.ts` are și `dedupe: ['react','react-dom']` — submodulul își are propriul
`node_modules` când e dezvoltat standalone, iar fără dedupe aplicația ar ajunge cu două
copii de React (simptomul e „Invalid hook call”, nu o eroare de modul).

Ce rămâne DOAR în OurDaysApp (nu face parte din joc): ecranul-înveliș `src/screens/Warlord.tsx`,
sincronizarea în cloud `src/warlordCloud.ts`, UI-ul PvP `src/warlordPvp/`, panoul de admin
`src/warlordAdmin/`.

## Fapte stabile (infra)
- **Stack:** React 18 + TypeScript + Vite + Tailwind CSS
- **State:** hooks custom (useGameState, useEconomy, useBarracks, useUnits) — fără Redux/Zustand
- **Persistență:** localStorage (`warlord_save`)
- **Moddare:** `src/logic/registry.ts` — GameRegistry singleton
- **Path local:** `c:\Users\besli\Desktop\MyWork\Apps\games\warlord` (mutat sub `Apps\games\` pe 2026-07-11)
- **Dev server:** `npm run dev` (port 5173) — sau preview managed: config `warlord` în `Apps\.claude\launch.json`
- **Build:** `npm run build`
- **Type check:** `npx tsc --noEmit`
- **Teste:** `npm run test` (Vitest) — motorul de combat are teste de determinism în `src/logic/combat/combat.test.ts`

## Reguli de lucru (hard)
- **Sync workflow:** după FIECARE task: `npx tsc --noEmit` verde → `npm run test -- --run` verde → `npm run build` verde → intrare în DEVLOG.md → commit → push → **urcă pointerul submodulului în OurDaysApp** (vezi secțiunea despre submodul)
- **DEVLOG.md** (append-only): Task Started + Task Completed cu timestamp, prompt exact, model
- **Plan mode** pentru orice feature care atinge mai mult de 2 fișiere
- **Nu modifica proiectele-soră din `Apps\`** (CNCVectorStudio, DataRead, OurDaysApp, PrestoConstruct) — sunt doar referință/context. NOTĂ: warlord e acum EL ÎNSUȘI sub `Apps\games\warlord`, deci regula veche „nu atinge Apps\" NU se aplică lui warlord; poți edita liber în `Apps\games\warlord\`. (Excepție permisă: `Apps\.claude\launch.json`, unde e configul de preview `warlord`.)
- **Fiecare feature nou** trebuie documentat în DEVLOG sub Roadmap înainte de implementare
- **Save/load** — orice state nou adăugat pe `Unit`, `Building`, sau `ResourceMap` trebuie inclus în `useGameState.tsx` la save și la load
- **Nu adăuga comentarii** care explică CE face codul — doar WHY când e non-obvious

## ⚠️ REGULĂ (Andrei, 2026-08-15): fereastra „ce e pe testing și încă nu e pe live"

Fiecare proiect capătă **două instanțe Firebase — `test` și `live`** — și, în adminul lui, o
**fereastră care arată tot ce e pe testing și nu a ajuns încă în live**. De implementat în
sesiunea dedicată proiectului ăstuia.

**Starea de azi:** `.firebaserc` are aliasul `live` lângă `default`; deploy-urile trec prin
`--project live`. Instanța de **test nu există încă** — se creează, se adaugă `"test": "<id>"`
în `.firebaserc`, și de-acolo deploy-urile cu `--project test` trec fără confirmare
(guard-ul din `Apps/.claude/hooks/deploy-guard.py` le recunoaște deja).

**Ce trebuie să arate fereastra — două lucruri diferite, nu unul:**
1. **Cod livrat** — ce commit-uri sunt pe test și nu pe live.
2. **Configurare/conținut editat din admin** — documentele pe care le schimbi din panou și
   care se *promovează* separat de cod (la Warlord `warlordConfig/live`, la Presto
   `settings/*`, la DataRead conținutul per-pagină). Astea nu se mișcă la un deploy.

**PRECONDIȚIA care se plătește ieftin acum și scump mai târziu:** o aplicație de pe test
nu are cum să știe ce e pe live decât dacă i se spune. Deci **fiecare deploy trebuie să-și
lase o amprentă** — un document de tip `meta/deployment` scris în propriul Firestore, cu
`gitSha`, `builtAt`, `deployedBy`. Fără amprenta asta fereastra n-are ce compara și ar
trebui să ghicească. Cu ea, `git log <shaLive>..<shaTest>` dă exact lista de schimbări.

**Decizia de arhitectură (o dată, nu de patru ori):** cum citește adminul de pe test starea
de pe live. Două variante — un serviciu de pe test cu drept de citire în proiectul live,
sau un callable pe live care-și întoarce propria amprentă. **A doua e de preferat:** nu cere
credențiale încrucișate și expune exact un câmp, nu toată baza.

**Nu porni implementarea fără să confirmi cu Andrei forma amprentei** — patru sesiuni care
inventează fiecare alt format înseamnă patru ferestre care nu se pot compara între ele.

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
    registry.ts   # GameRegistry singleton (items + units); UnitDef.combat? = override moddabil de stat-uri
    combat/       # motor de luptă PUR + DETERMINIST (fără React/Firestore) — reutilizabil server-side pt PvP
      types.ts    # BattleState, Combatant, Command (toate JSON-serializabile; grid = map-of-rows)
      rng.ts      # PRNG cu sămânță (mulberry32); poziția = rngCursor din state
      stats.ts    # DEFAULT_COMBAT_STATS + matrici counters + terrain + tunables
      engine.ts   # applyCommand (reducer), legalMoves/Targets, computeAttack, checkVictory
      ai.ts       # chooseEnemyCommands — pur, determinist, nu consumă rng-ul luptei
      army.ts     # unitToCombatant + applyBattleResult (write-back pierderi/XP/morală)
      enemies.ts  # MISSION_PRESETS + generateEnemyArmy/Terrain + createBattle
  state/          # React state hooks
    useGameState.tsx  # hook principal, exportă tot ce au tab-urile
    useEconomy.ts     # wallet, inv, buildings, resources
    useBarracks.ts    # barracks pool, recruits, batches
    useUnits.ts       # lista de unități active
    useCampaign.ts    # slice campanie: luptă activă, deployedIds, reward, record W/L
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
- **`state as any` in a tab is how a broken button ships:** `UnitsTab` asked for `createUnit` while the state exported `createUnitFromBarracks`, so `Create Unit` threw `onCreate is not a function` on every press — silently, past a green typecheck, and the army could never go from 0 units to 1. Tabs destructure `GameStateShape` directly; never re-introduce the cast, and never add `?? (() => {})` fallbacks that turn a missing handler into "nothing happens". (The older "dual `units` state" trap that used to be documented here was fixed long ago — `unit.setUnits` is the only army list.)
- **Refuzurile trebuie să fie vizibile ACOLO unde apeși.** `addLog` scrie într-un alt tab; un buton care rămâne activ și nu face nimic e citit, corect, ca joc stricat. Tiparul e `evaluateCost`/`checkAction` (`logic/costs.ts`, `logic/barracks.ts`): buton dezactivat + ce lipsește, lângă el.
- **`u.equip` E populat acum** — echipamentul rămâne pe unitate, deci `computeEquipped`/`fieldedStrength` măsoară ceva real. `requiredCountsFor` citește din Registry, iar un Registry neinițializat întoarce cerință GOALĂ, adică fiecare unitate pare complet echipată: orice test pe zona asta cheamă `Registry.init()`.
- **Motorul de combat trebuie să rămână PUR:** fără `Math.random`/`Date.now`/`Map`/`Set`/instanțe de clasă în `combat/{types,rng,stats,engine,ai}`. Toată aleatorietatea prin `rng.ts` (avansează `rngCursor`). Grid serializat ca map-of-rows `{"0":[...]}` (Firestore refuză array-uri imbricate). ID-uri deterministe `P0/E0`.
- **Seed-ul luptei** se alege UI-level (`Math.random` în `startBattle` e OK — nu face parte din motor); lupta e complet reproductibilă din seed-ul stocat în state.
- **Save/load campanie:** `campaign` e în obiectul de save + în dep-array-ul useEffect + în `loadSave` + în `resetAll` (4 locuri).
