# Warlord

Browser strategy game in React + TypeScript: run a medieval domain — buildings, resources,
equipment, unit training, research, and turn-by-turn grid battles. Offline-first; the whole
game runs in the browser with the save in localStorage.

**This repo is the game's home.** It is developed and versioned here on purpose: the game is
its own product and may be distributed through channels other than the app it currently ships
in (its own site, a PWA, another host).

## Where it runs today

- Inside **OurDaysApp** at `/warlord` — live at <https://our-days-2a939.web.app/warlord>.
  There it also gets what a standalone build cannot have: a cloud-synced kingdom per user,
  server-authoritative PvP, and an admin panel for balance.
- **On its own**: `npm run dev` for the game alone, `npm run build` for a static bundle.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npx tsc --noEmit     # type check
npm run test         # Vitest (96 tests)
```

## Working on it

See `CLAUDE.md` for the architecture map, the hard rules, and the known traps.
`DEVLOG.md` is the append-only history.
