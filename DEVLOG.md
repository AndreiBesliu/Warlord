# DEVLOG — Warlord

## Reguli DEVLOG
- **Append-only** — nu se șterg intrări istorice
- Fiecare task are **Task Started** și **Task Completed** cu timestamp, prompt exact, model
- Roadmap-ul e updatat la fiecare sesiune
- Format timestamp: `YYYY-MM-DD HH:MM`

---

## 🚀 Active Roadmap & Backlog

### În curs / Următor
- **Combat System (grid tactic)** 🔨 ÎN CURS — tab nou "Campaign", luptă tură-cu-tură pe grid; motor pur + determinist (RNG cu sămânță) reutilizabil server-side pentru PvP viitor; PvE acum + document design PvP (OurDaysApp)
- **PvP în OurDaysApp** — integrare Warlord ca joc în arcade-ul OurDaysApp (Cloud Function autoritativ pe același motor); design în `docs/PVP_INTEGRATION.md`, implementare sesiune viitoare
- **Upgrade clădiri** — `level` pe `Building`, bonusuri producție per nivel
- **Comandanți/Lideri** — unitate specială cu bonusuri (XP, training time)

### Completate în sesiuni anterioare (mutate din roadmap)
- Unit Upkeep zilnic, Sistem Hrană (FOOD/FARM), Morale & Oboseală, Sistem Evenimente aleatorii

### Backlog
- **Rute comerciale pasive** — vânzări automate zilnice din Market
- **Tech Tree** — cercetare cu resurse + timp

---

## ✅ Features Completate

### Sistem de bază (pre-sesiune 1)
- Economy loop: clădiri → producție pasivă → wallet
- Resurse: WOOD, STONE, ORE, COAL, ingots
- Barăci: recrutare, antrenament batches, conversie tip/rang
- Unități: split, merge, replenish, training XP
- Market: cumpărare/vânzare echipament și resurse
- Save/Load localStorage
- Sistem modding (Registry)

---

## 📅 Session Log

### Session 3 — 2026-07-11

**2026-07-11 - Task Started**
> Prompt: "poti sa vezi folderul games, vreau sa lucram la jocuri online in aces folder" → decizii: (1) Warlord devine multiplayer și va trăi în interiorul OurDaysApp (fără deploy separat deocamdată); (2) sesiunea asta = Combat System, model grid tactic tură-cu-tură; (3) livrăm motor determinist + PvE complet în Warlord standalone + document de design PvP pentru OurDaysApp (implementat sesiunea viitoare).
> Plan: Motor de luptă PUR și DETERMINIST (RNG cu sămânță) în `src/logic/combat/` (types, rng, stats, engine, ai, enemies, army) ca să ruleze identic pe client (PvE) și mâine într-un Cloud Function (PvP verificabil). Stat-uri de combat + matrice counters (nu există azi). Slice `useCampaign` + tab `CampaignTab` cu grid. Pierderi aplicate înapoi în armată (închide bucla economică). Teste Vitest pe determinism. Doc `docs/PVP_INTEGRATION.md`.
> Model: Claude Opus 4.8

**2026-07-11 - Task Completed**
> Model: Claude Opus 4.8
> Changes:
> - **Motor pur de combat** `src/logic/combat/` (nou): `types.ts` (BattleState/Combatant/Command JSON-serializabile, grid map-of-rows), `rng.ts` (mulberry32 cu sămânță, poziția = `rngCursor`), `stats.ts` (`DEFAULT_COMBAT_STATS` pt toate 11 tipurile + matrici counters `weaponVsArmor`/`weaponVsMounted`/cav-vs-ranged/brace/shield + tabel terrain + tunables), `engine.ts` (`applyCommand` reducer pur, `legalMoves`/`legalTargets`, `computeKillsCore`/`resolveDamage`/`estimateKills`, `checkVictory`, `buildBattle`), `ai.ts` (`chooseEnemyCommands` determinist, planifică cu daune medii, nu consumă rng-ul luptei), `army.ts` (`unitToCombatant`, `fieldedStrength`, `applyBattleResult` write-back pierderi rank-crescător/XP/morală + șterge distrusele), `enemies.ts` (`MISSION_PRESETS` bandit/baron/invazie + `generateEnemyArmy`/`generateTerrain`/`createBattle`), `index.ts` barrel.
> - `src/logic/units.ts`: extras `computeEquipped` din `computeReady` (refactor behavior-preserving) + comentariu despre `equip` gol.
> - `src/logic/registry.ts`: `UnitDef.combat?` (override moddabil de stat-uri, injectat, nu citit în hot-path).
> - `src/state/useCampaign.ts` (nou): slice campanie (luptă activă, deployedIds, reward, record W/L, lastResult).
> - `src/state/useGameState.tsx`: instanțiere `useCampaign`; funcții `grantLoot`/`startBattle`/`battleCommand`/`runEnemyTurn`/`finishBattle`/`abandonBattle`/`dismissBattleResult`; `campaign` în save+dep-array+load+reset; export tot în return.
> - UI (nou): `components/tabs/CampaignTab.tsx` (state machine MENU/DEPLOY + luptă + rezultat, auto-enemy-turn via useEffect) + `components/campaign/{BattleGrid,BattleLog,MissionList,DeployPanel,ResultScreen}.tsx`. Wiring `App.tsx` (tab „Campaign").
> - Teste: Vitest instalat + `combat.test.ts` (10 teste: determinism seed, serialize/resume, AI pur, counters, conservare pierderi, veterani supraviețuiesc, unitate distrusă scoasă, luptă completă la rezoluție). Script `test`/`test:watch`.
> - `docs/PVP_INTEGRATION.md` (nou): design integrare PvP în OurDaysApp (schemă Firestore, Cloud Function autoritativ pe același motor, partajare cod `shared/`, întărire rules, i18n, limitări).
> - `CLAUDE.md`: path corectat (`Apps\games\warlord`), regula „nu atinge Apps\" re-scopată la proiectele-soră, hartă combat, capcane noi (equip gol, dual-units bug, puritate motor, save campanie).
> Build: `npx tsc --noEmit` ✅ | `npm run build` ✅ (2.27s) | `npm run test` ✅ (10/10)
> Verificare end-to-end (dev server, prin DOM — screenshot-urile panoului dădeau 0x0): Bandit Raid jucat până la victorie — armată generată determinist (forță 75 ≈ 0.6×125, morală 70, plasare corectă), select/move/attack + AI inamic funcționale, la victorie prada +3000c (=40×75) în wallet, pierderile scrise înapoi (4→2 unități, veteranii supraviețuiesc, +XP), record 1W/0L, persistat în localStorage.

**2026-07-11 - Task Completed (embed în OurDaysApp)**
> Prompt: "vreau sa ii facem deploy in aplicatia OurDaysApp si sa il lucram acolo, iar eu sa il testez in aplicatie"
> Model: Claude Opus 4.8
> Decizii: tot jocul single-player ca rută `/warlord` în OurDaysApp; i18n în engleză deocamdată; ambele repo-uri ținute IDENTICE.
> Changes:
> - Copiat codul de joc în `OurDaysApp/src/warlord/` (logic/state/components/mods/assets + App.tsx→WarlordApp.tsx). Rută lazy `/warlord` + `src/screens/Warlord.tsx` wrapper + buton ⚔ (Swords) în header CalendarHome (desktop+mobil).
> - Curățenie strict-compat (aplicată în AMBELE copii ca să rămână identice): `import type` (verbatimModuleSyntax), eliminat importuri/variabile nefolosite (React inutil cu jsx:react-jsx, dead destructure în App/BuildingsTab, dead local `units` state → `const [, setUnits]`, funcție `hasFreeBatchSlot` nefolosită etc.).
> - Adăugat notă de sincronizare în CLAUDE.md.
> Build: standalone `tsc --noEmit` ✅ + `test` ✅ (10/10); OurDaysApp `tsc -b` ✅ + `vite build` ✅ (Warlord = chunk lazy 118kB/gzip 32kB, bundle principal neschimbat) + deploy hosting ✅ (live: our-days-2a939.web.app/warlord).
> Verificat local (bypass temporar de auth, revenit): Warlord se randează la /warlord fără erori de consolă; flux complet Load→Campaign→Deploy→March→grid de luptă funcțional în contextul embed.

### Session 2 — 2026-06-20

**2026-06-20 - Task Started**
> Prompt: "toate suna bine, vreau ca inainte sa adaugi ceva, sa iti faci un plan de implementare si sa verifici apoi, daca codul actual este corect, optim si sa il aduci up to speed" + "nu vreau sa modifci nimic in folderul apps, vreau doar sa intelegi modul de lucru pe care il vreau" + "ok, deci, vreau sa intelegi modul de lucru din apps si sa aplici pentru warlord, acum, continua cu dezvoltarea jocului"
> Plan: Aplică metodologia din Apps (CLAUDE.md + DEVLOG), continuă cu Fazele 3.1-3.4 din plan
> Model: Claude Sonnet 4.6

**2026-06-20 - Task Completed**
> Model: Claude Sonnet 4.6
> Changes:
> - `CLAUDE.md` creat — reguli permanente, arhitectură, capcane cunoscute
> - `DEVLOG.md` creat — metodologie + session log
> - `src/logic/economy.ts`: `dailyUpkeepCopper()` — cost zilnic per soldat (tip × rank); `dailyFoodConsumption()` — consum hrană per soldat; `RESOURCE_BUILDING_BASE_VALUE` include FOOD; `FARM` adăugat la `BuildingCostCopper`, `ResourceBuildingCosts`, `BuildingOutputChoices`
> - `src/logic/types.ts`: `FOOD` adăugat la `ResourceType`; `FARM` adăugat la `Building.type`; `morale: number` adăugat pe `Unit`
> - `src/logic/units.ts`: `computeReady()` aplică factor morale (50%–100%); `applyMoraleChange()` — modifică morale zilnic bazat pe upkeep + hrană; `mergeUnits()` calculează morale ponderat; `splitUnit()` propagă morale
> - `src/logic/events.ts` creat — 6 tipuri de evenimente aleatorii (RAID, EPIDEMIE, etc.); `rollDailyEvent()` cu 15% șansă/zi
> - `src/logic/registry.ts`: FOOD înregistrat ca item
> - `src/state/useGameState.tsx`: `runDailyTick()` integrează upkeep + consum hrană + morale update + evenimente aleatorii; unit creat cu `morale: 100`
> - `src/state/useEconomy.ts`: FOOD în resources inițiale
> Build: `npx tsc --noEmit` ✅ | `npm run build` ✅ (3.31s)

### Session 1 — 2026-06-20

**2026-06-20 - Task Started**
> Prompt: "intentionez sa adaug complexitate jocului, vreau sa imi dai sugestii"
> Plan: Audit complet codebase + identificare buguri + plan de implementare features noi
> Model: Claude Sonnet 4.6

**2026-06-20 - Task Completed**
> Model: Claude Sonnet 4.6
> Changes:
> - `src/logic/units.ts`: Fix `computeReady()` (returna 0 fără constrângeri → returna `size`); fix `splitUnit()` horses ca `{active,inactive}` nu scalar; curățat comentarii verbose din `requiredCountsFor()`; extras helpers `splitScalarEquip`/`subtractScalarEquip`
> - `src/logic/economy.ts`: Fix Lumber Mill — nu mai e hardcodat la 10 WOOD, respectă `focusCoinPct` via `RESOURCE_BUILDING_BASE_VALUE`
> - `src/logic/batches.ts`: Eliminat bloc comentat imens (implementare veche); formula `batchSlots` corectată la `Math.min(level + 1, 5)`
> - `src/logic/registry.ts`: Adăugată validare la `registerItem()`/`registerUnit()` + warning la duplicate ID
> - `src/logic/training.ts`: `setWallet(() => res.wallet)` → `setWallet(w => w - res.spent)`; eliminat comentarii narative; ordine corectă checks-before-mutations
> - `src/state/useGameState.tsx`: Fix stale closure în `doMergeIfReady()`; `setWallet()` scos din callbacks setState în `sell()`; `econ.resources` adăugat la useEffect deps
> - `src/state/useBarracks.ts`: `recruit()` blendează corect `avgXP` în loc să reseteze la 0
> - `CLAUDE.md` + `DEVLOG.md` create (metodologie din Apps aplicată)
> Build: `npx tsc --noEmit` ✅ fără erori
