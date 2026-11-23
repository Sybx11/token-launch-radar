# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Sybx11/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Sybx11/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar for the make.fun `token-radar-01` bounty. It reads the sealed DefiLlama snapshot, finds every protocol that records no token, and ranks it by an implied value priced against the live-token protocols in its own sector.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

Node 22.18 or later, standard library only. Writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory.

## Model

- **Sector multiple**: each sector's median market-cap / TVL over its live-token peers (each median capped at 1.00 first), shrunk toward the whole-market median (prior weight 5), clamped to 0.05–1.00.
- **Implied value** = TVL × sector multiple × growth (7d TVL change, 0.4 weight, clamped −50%..+100%) × maturity (0.70 + age/1095 × 0.30) × chain breadth (1 + 0.02 per extra chain, up to 5).
- **Coverage**: all 40 watchlist protocols plus every other rankable pre-token protocol in the snapshot — 226 rows, no arbitrary cap.
- **Farm plan**: six steps per protocol, derived from its category, chains, TVL and age; risk notes from the same record.

## Layout

- `main.ts` — entrypoint: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — the radar-2 model, the board builder and the gate check.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied byte for byte.
- `dashboard/` — the static page (index.html, app.css, app.js); no network.
- `screenshots/` — the board, a protocol detail view and a filtered view.

Implied values are this entry's own claim from the sealed snapshot alone. No token is promised, and nothing here is investment advice.

---

<sub>Entered on [make.fun](https://make.fun/?ref=97bsz87j&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
