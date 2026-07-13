# Warlord PvP — Integration Design (OurDaysApp)

> Status: **SHIPPED & LIVE (2026-07-12).** Server-authoritative PvP is implemented and
> deployed. Actual implementation differs from parts of the design below — see
> "Implemented vs designed" and "Known limitations (post-ship)".

## Implemented vs designed (source of truth)
- Challenge creation goes through a **`createWarlordChallenge` callable**, NOT a client
  `addDoc`. The challenger's army is stored in an **Admin-only `warlordDeploys/{gameId}`**
  doc so the opponent can't read it before committing (closes a counter-pick exploit the
  first cut had). The public `games` doc has NO army data while `waiting`.
- Callables: `createWarlordChallenge`, `acceptWarlordChallenge`, `submitWarlordCommand`,
  `forfeitWarlordBattle`; trigger `onWarlordBattleUpdated` (turn/lifecycle FCM push).
- Deploy sanitization drops BOTH `statsOverride` AND `loadoutWeapon` (a mismatched weapon
  swapped `weaponClass` while keeping the type's range → a ranged unit with melee
  counters; PvP is strictly vanilla stats now).
- Engine copy lives at `OurDaysApp/functions/src/warlordCombat/` (3rd byte-identical copy).
- Client UI: `OurDaysApp/src/warlordPvp/` + a Domain|PvP toggle in `screens/Warlord.tsx`.

## Known limitations (post-ship, decide later)
- **No turn timeout.** A player who stops moving stalls the match; the opponent's only
  exit is `forfeitWarlordBattle` (a self-inflicted loss). A per-turn deadline +
  `claimWarlordTimeout` callable (or a scheduled sweep + `chooseEnemyCommands` auto-play)
  is the fix.
- **Full information once playing.** `state` is readable by both players (same as Rummy
  hands). Fog-of-war would need per-player subdocs.
- **i18n:** PvP UI is English-only for now (per Andrei's standing decision for Warlord).
- **Army provenance is unverifiable.** Deploy payloads are client-claimed (army lives in
  localStorage); sanitizeDeploy BOUNDS them but can't prove them. A server-side domain
  registry is the real fix if cheating becomes a concern.

---

> Original design (kept for reference; some parts superseded above):

---

## 1. Goal & the key idea

Two players each bring a detachment of their own army to a shared, turn-based tactical
battle. The battle is **server-authoritative**: neither client is trusted to compute the
result. The same pure engine we already wrote (`applyCommand`) validates and applies every
move — on the client for optimistic UI, and in a Cloud Function as the source of truth.

**The reconciliation that makes v1 tractable** — Warlord is a *persistent domain* game
(buildings, resources, day tick), but OurDaysApp arcade games are *bounded sessions*
scoped to a group + calendar date (see the arcade audit). We do **not** move the persistent
domain to the server for v1. Instead:

- A PvP match is a **bounded battle session**. Each player *exports a detachment* (selected
  units → `Combatant[]`) into the match. The domain stays in each player's `localStorage`.
- On match end, the result (casualties/loot) is written back into each player's **local**
  army via the existing `applyBattleResult`, exactly as PvE does today.

This sidesteps "where does the persistent domain live" entirely — the server only ever owns
one `BattleState`, which is already fully serializable.

---

## 2. What already exists and is reusable verbatim

Everything in `src/logic/combat/` is pure, JSON-serializable, and deterministic:

| File | Reused on server as-is? | Notes |
|---|---|---|
| `types.ts` | ✅ | `BattleState` is plain JSON; grid is already **map-of-rows** (Firestore-safe). |
| `rng.ts` | ✅ | PRNG position = integer `rngCursor`; no hidden state. |
| `stats.ts` | ✅ | Pure tables + resolvers. `resolveStats` takes an **injected** override (never reads the client `Registry`). |
| `engine.ts` | ✅ | `applyCommand(state, cmd) → state` is the authority. Illegal cmd → unchanged state + `skipped` log (a bad client message can't desync). |
| `ai.ts` | ✅ (optional) | Only needed if PvP allows a bot opponent / auto-forfeit. |
| `army.ts`, `enemies.ts` | ⚠️ setup layer | `army.ts` imports the client `Registry` for the moddable stat override and display name. On the server, build `Combatant[]` from the serialized deploy payload instead (see §6), or hoist the pure parts. |

**Determinism guarantees already in place** (see `combat.test.ts`): same `(state, commands)`
→ identical final state; mid-battle `JSON.parse(JSON.stringify(state))` round-trips exactly;
AI is a pure function of state and consumes no battle rng.

---

## 3. The code-sharing problem (must solve first)

Today the two packages cannot share code:

- OurDaysApp frontend `tsconfig` and `functions/tsconfig.json` (`rootDir: "src"`, `include: ["src"]`)
  are isolated — functions **cannot** `import ../src/...`.
- Warlord lives in a *third* repo entirely (`games/warlord`).

**Recommended: a small shared package.** Create `ourdaysapp/shared/warlord-combat/` containing
a copy of the pure engine (`types, rng, stats, engine` — and `ai` if used). Reference it from
both tsconfigs via path mapping / project references:

```jsonc
// functions/tsconfig.json  and  frontend tsconfig
"compilerOptions": { "paths": { "@warlord-combat/*": ["../shared/warlord-combat/*"] } }
```

- Keep the shared copy **pure** — no React, no `Registry`, no `firebase-admin`, no `firebase/*`.
- `resolveStats` already accepts an injected `override`, and `Combatant.statsOverride` travels
  in serialized state, so the server never needs the client `Registry`.
- Sync policy: the shared copy is the source of truth for PvP; Warlord's `src/logic/combat/`
  can either import from it (monorepo) or be kept in sync manually (documented, like the
  existing `ADMIN_BOOTSTRAP_EMAILS` duplication note). Prefer a monorepo/workspace so there
  is exactly one copy.

**Avoid** the `Math.random()`-for-ids and `Date.now()` traps: the engine already uses neither.
Battle seeds are the only randomness source and are chosen by the **server** (see §7).

---

## 4. Firestore schema

Reuse the existing flat `games` collection and the arcade conventions (top-level
`status`/`winner`, per-game data under `state`, `groupId`+`date` scoping).

```ts
// games/{gameId}
{
  groupId: string,
  date: "yyyy-MM-dd",
  gameType: "warlord-battle",          // new dispatch id
  status: "waiting" | "playing" | "finished",
  createdAt: serverTimestamp,
  createdBy: uid,
  winner: uid | null,                  // top-level, per arcade convention

  // players & turn ownership (Rummy-style)
  playerIds: [uidA, uidB],             // index 0 = PLAYER side, index 1 = ENEMY side
  seed: number,                        // set by the server at start

  // the authoritative battle — a serialized BattleState (already Firestore-safe)
  state: {
    version: 1, seed, rngCursor,
    width, height,
    terrain: { "0": [...], "1": [...] },   // map-of-rows — NO nested arrays
    combatants: [ { id, side, unitId, type, x, y, hp, hpStart, morale, vet, kills,
                    hasMoved, hasActed, routed, buckets, statsOverride? }, ... ],
    turn, side, phase, status, winner, log, config, difficulty
  },

  // deploy payloads, kept so the server can rebuild/validate and each client can
  // write casualties back into its OWN local army after the match
  deploy: {
    [uidA]: { unitIds: string[], combatants: Combatant[] },
    [uidB]: { unitIds: string[], combatants: Combatant[] }
  }
}
```

Notes
- `state.combatants` is a flat top-level array (allowed). The grid is a map-of-rows (Firestore
  rejects nested arrays — this is why the engine already stores terrain that way).
- Map `side` to seat: `combatant.side === 'PLAYER'` ⇢ `playerIds[0]`, `'ENEMY'` ⇢ `playerIds[1]`.
- A composite index on `games(groupId, date)` may be needed (the arcade query already filters
  on both) — add to `firestore.indexes.json` (which does not exist yet).

---

## 5. Turn ownership & real-time sync

- **Whose turn:** `state.side` maps to `playerIds[side==='PLAYER'?0:1]`. A client may only submit
  commands when `playerIds[...] === auth.currentUser.uid` and `state.status === 'ONGOING'`.
- **Sync:** reuse the arcade's single `onSnapshot` on the `games` doc (GamesHubModal already
  subscribes by `groupId`+`date`). Each `submitWarlordCommand` write re-renders both clients.
- **Optimistic UI:** the mover's client may apply `applyCommand` locally for instant feedback,
  then reconcile with the authoritative doc the Function writes (they must match, by determinism).

---

## 6. Cloud Function — the authority

Follow the established `onCall` + `HttpsError` + Admin SDK + `runTransaction` pattern
(`createEventOverride`, `respondToFriendRequest`, `acceptGroupInvite` in `functions/src/index.ts`).

```ts
// functions/src/index.ts
import { applyCommand } from "@warlord-combat/engine";
import { chooseEnemyCommands } from "@warlord-combat/ai"; // only if a bot/forfeit is needed

export const submitWarlordCommand = onCall({ enforceAppCheck: ENFORCE_APP_CHECK }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in.");
  const { gameId, command } = req.data ?? {};
  if (!gameId || !command) throw new HttpsError("invalid-argument", "gameId + command required.");

  const db = admin.firestore();
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`games/${gameId}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Game not found.");
    const g = snap.data()!;
    if (g.gameType !== "warlord-battle" || g.status !== "playing")
      throw new HttpsError("failed-precondition", "Not an active Warlord battle.");

    const battle = g.state;
    // Authoritative turn check — the caller must own the side to move.
    const seatUid = g.playerIds[battle.side === "PLAYER" ? 0 : 1];
    if (seatUid !== uid) throw new HttpsError("permission-denied", "Not your turn.");

    // The SAME pure reducer validates legality; illegal commands are no-ops (never trusted).
    const next = applyCommand(battle, command);

    const patch: any = { state: next };
    if (next.status !== "ONGOING") {
      patch.status = "finished";
      patch.winner = next.winner ? g.playerIds[next.winner === "PLAYER" ? 0 : 1] : null;
    }
    tx.update(ref, patch);
    return { ok: true };
  });
});
```

Expose it via `src/serverActions.ts` (`httpsCallable(getFunctions(app), "submitWarlordCommand")`),
mirroring `createEventOverride`.

**Server owns the seed.** At start (a `startWarlordBattle` callable or the owner's Start action),
the Function picks `seed` (a non-guessable server value), builds terrain + places both deploy
payloads via the shared setup code, writes the initial `state`, and flips `status:"playing"`.
Because the seed lives server-side until the doc is written, neither client can precompute rng.

**Anti-cheat recap:** all move legality (range, LOS, occupancy, turn order, one-move/one-attack)
is enforced by `applyCommand` inside the transaction; clients can only *propose* commands. Damage
variance is seeded and applied server-side. There is no field the client can write directly.

---

## 7. Firestore rules

Tighten the current games rule (today `allow update: if isMemberOfGroup(...)` lets **any**
member overwrite `state`). Route all Warlord mutations through the callable (Admin SDK bypasses
rules), and forbid direct client writes to a battle's `state` — mirror the `notifications`
pattern (`create: if false`, all writes via `notifyUsers`).

```
match /games/{gameId} {
  allow read: if isSignedIn() && isMemberOfGroup(resource.data.groupId);
  allow create: if isSignedIn()
    && request.resource.data.createdBy == request.auth.uid
    && isMemberOfGroup(request.resource.data.groupId);
  // Warlord battles: clients may NOT patch state directly — only the callable (Admin SDK) may.
  allow update: if isSignedIn() && isMemberOfGroup(resource.data.groupId)
    && !(resource.data.gameType == "warlord-battle" &&
         request.resource.data.diff(resource.data).affectedKeys().hasAny(["state","winner","status"]));
  allow delete: if isSignedIn() && resource.data.createdBy == request.auth.uid;
}
```

(Keep the looser path for the existing client-authoritative arcade games; the guard only fences
`gameType == "warlord-battle"`.)

---

## 8. Matchmaking / lobby

Reuse the arcade flow verbatim: creator makes a `waiting` doc seated as `playerIds[0]`;
`onGameCreated` already pushes an FCM invite to group members; the opponent Joins to become
`playerIds[1]`; the owner (or auto) Starts → `startWarlordBattle` callable builds `state` and
sets `status:"playing"`. No new matchmaking system needed.

---

## 9. Frontend integration in OurDaysApp

- Register `gameType: "warlord-battle"` in the four hard-coded spots in `GamesHubModal.tsx`
  (catalog card, `handleCreateGame` initial payload, render dispatch, `gameTypeName`).
- Add a `Warlord.tsx` game component. It can **reuse the Warlord `BattleGrid`/`BattleLog`
  components' logic** (port them into OurDaysApp or the shared package). Read the live `state`
  from the `game` prop; submit moves via the `submitWarlordCommand` callable instead of
  `battleCommand`.
- **Deploy step:** the player picks units from their local Warlord army (imported/serialized
  into OurDaysApp somehow — for v1 a simple JSON import, or a bundled demo army). `unitToCombatant`
  produces the `Combatant[]` deploy payload.
- **Write-back:** on `status:"finished"`, each client runs the existing `applyBattleResult`
  against its **own** deploy payload + local army and persists locally. (Loot rules for PvP —
  e.g. victor pillages a share — are a design choice to make then.)

---

## 10. i18n

All player-facing strings go through OurDaysApp's `t(key, lang)` in `src/utils/i18n.ts`, added
to **all 6 locales** (en/ro/fr/es/it/de), plus a `getGameRules` entry in `GamesHubModal.tsx`.
Warlord's current UI strings are English literals — translate them at port time. Soldier/terrain
type ids stay as keys (`t('warlord_type_LIGHT_INF_SPEAR', lang)` etc.).

---

## 11. Known limitations to decide on later

- **No hidden information.** The single-doc model exposes all of `state` to both group members
  (the same reason Rummy hands are visible today). Fog-of-war / hidden deployment would need
  per-player subdocuments with tighter rules or a server-only visibility layer — out of scope
  for v1. Warlord battles are full-information by default, which is fine for a tactics game.
- **Concurrency.** The transaction serializes writes; a stale client command targeting an
  already-dead unit becomes a `skipped` no-op (engine handles it) — safe, not a desync.
- **Disconnect / timeout.** Add a per-turn deadline + a `forfeitWarlordBattle` callable (or let
  `chooseEnemyCommands` auto-play a timed-out side) so a match can't hang forever.

---

## 12. Migration checklist (next session)

1. Stand up `shared/warlord-combat/` (pure engine copy) + path mappings in both tsconfigs.
2. `firestore.indexes.json`: add `games(groupId, date)` composite index.
3. `functions/src/index.ts`: `startWarlordBattle` + `submitWarlordCommand` (+ optional forfeit).
4. `src/serverActions.ts`: thin callable wrappers.
5. `firestore.rules`: fence `state/winner/status` writes for `warlord-battle`.
6. `GamesHubModal.tsx`: register the new `gameType` (4 spots) + `getGameRules` + `gameTypeName`.
7. `Warlord.tsx`: port `BattleGrid`/`BattleLog`, read live `state`, submit via callable.
8. Deploy/army export UI + `applyBattleResult` write-back to the local army.
9. i18n keys in all 6 locales.
10. Playtest determinism: client-optimistic `applyCommand` must equal the server-written `state`.
```
