# UpJump — Brego Games Originals

A browser-first, single-file vertical arcade platformer: collect stars, build combos, avoid drones and unleash **Nova Dash** once the energy bar reaches 100%.

**Live site:** https://upjump.pages.dev/

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move | ← / → arrows | ◀ / ▶ on-screen buttons, or touch a screen edge |
| Nova Dash (requires 100% energy) | Space | ⚡ NOVA button |
| Pause / resume | P / Escape / top-right pause button | Top-right pause button |
| Return to start menu | Pause/over screen → ☰ Ana Menü | Same |
| Fullscreen | F | Browser fullscreen when supported |
| Sound | 🔊 / 🔇 toggle | 🔊 / 🔇 toggle |

On mobile, holding one direction button does not block the other thumb from pressing Nova Dash. The game auto-pauses when the tab is backgrounded or the window loses focus. Online play is **not** part of this single-player game.

## Saving

- Highest score is saved in the browser's localStorage under `upjump-best`. Non-numeric/corrupt entries are ignored.
- Sound preference is saved under `upjump-sound` (`1` = on, `0` = muted).
- Current in-progress runs are not preserved after closing the page. Do not market this as cloud save or full session resume.

## Run locally

```sh
python -m http.server 8123 --directory public
```

Open http://127.0.0.1:8123/.

## Tests

```sh
node scripts/smoke.mjs
```

The `.github/workflows/game-qa.yml` workflow runs a source-level and simulated interaction smoke test on each relevant push and pull request. It checks game start, mobile Nova, muting, pause/resume, menu return and fixed-step simulation at lower frame rates. It is not a substitute for Android/iOS touch and audio QA.

## Release

Cloudflare Pages uses `wrangler.jsonc` with `pages_build_output_dir: "./public"`. The canonical deployment target is https://upjump.pages.dev/. After code changes, check the current live HTML release marker `upjump-mobile-audio-20261117-r1`, the on-screen mobile controls and actual touch/audio behavior. A GitHub commit alone is not proof that deployment completed.

## 2026-11-17 improvements

- Added visible two-thumb mobile steering and Nova Dash.
- Added synthesized in-game audio and remembered mute setting; no copyrighted recordings or samples.
- Added background auto-pause, Escape pause/resume, pause/death-to-menu return.
- Switched to bounded 60 Hz simulation stepping so a 15–30 FPS canvas does not run gameplay in slow motion.
- Improved small-viewport scaling, keyboard-focus labels and invalid high-score handling.
