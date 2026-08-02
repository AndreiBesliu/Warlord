# Warlord — ARCHIVED

**This repository is no longer where Warlord is developed.** As of 2026-08-02 the game
lives inside the OurDaysApp repository, which is also where it is played:

- Source (single copy): `src/warlord/**` in <https://github.com/AndreiBesliu/ourdaysapp>
- Live: <https://our-days-2a939.web.app/warlord>
- Standalone dev harness (no auth, no cloud): `npm run dev:warlord` in that repo

## Why it moved

The game code existed as **two byte-identical copies** — this repo and
`OurDaysApp/src/warlord/` — kept in sync by hand on every change. That duplication was a
permanent tax and a permanent risk: a fix applied to one copy and not the other is
invisible until it reaches a player. There is now one copy.

The CI here was also failing on every push since 2025-12-04 (it tried to publish to
GitHub Pages with a read-only token, so the `gh-pages` branch was never created), sending
a failure e-mail each time. That workflow has been removed.

This repo is kept for its history. Nothing here is built, deployed or maintained.
