# UpJump — Brego Games Originals

A browser-first, single-file, **portal-ready** vertical arcade climber: collect stars, ascend through 5 dynamic atmospheric biomes, chain combos, smash patrol drones, and unleash **Nova Dash** once energy hits 100%.

**Live site:** https://upjump.pages.dev/

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move | `←` / `→` or `A` / `D` | `◀` / `▶` on-screen pads, or touch/drag screen edges |
| Nova Dash (100% energy) | `Space` / `↑` / `W` / `Shift` | `⚡ NOVA` button |
| Pause / Resume | `P` / `Escape` / Pause button | Top-right Pause button |
| Quick Restart | `R` (when paused or run over) | Restart / Play Again button |
| Mute / Unmute | `M` / Sound button | Top-right Sound button |
| Fullscreen | `F` / Fullscreen button | Fullscreen button (when supported) |
| Language | `EN` / `TR` switcher in overlay | Same |

## Portal Readiness (Poki, CrazyGames, GameDistribution, itch.io)

- **Zero external network requests:** Self-contained single HTML5 file (`public/index.html`) with inline SVG favicon/wordmark, zero external Google Fonts CDN calls, and 100% procedural Web Audio synthesis (zero copyrighted assets).
- **Iframe-friendly headers:** `public/_headers` permits cross-origin portal iframe embedding (no `X-Frame-Options: SAMEORIGIN` blocker) and prevents keyboard scroll bleed (`Arrow*` / `Space`) plus long-press context menus on mobile.
- **Resilient storage:** `safeStorage` automatically falls back to in-memory persistence inside strict sandboxed iframes where `localStorage` is blocked.
- **Built-in Portal SDK Adapter (`window.UpJumpPortal`):** Auto-detects `window.PokiSDK`, `window.CrazyGames.SDK`, and `window.gdsdk` to emit `gameLoadingFinished`, `gameplayStart`, `gameplayStop`, and `happyTime` events, and exposes `UpJumpPortal.pauseForAd()` / `UpJumpPortal.resumeAfterAd()` for commercial/rewarded ad breaks.
- **Auto-localized EN / TR UI:** Automatically detects browser language (`tr` vs `en`) with a one-tap manual `EN | TR` switcher.

## Visual & Technical Highlights

- **High-DPI (Retina) Canvas:** Backing buffer scales cleanly up to `2.5x` `devicePixelRatio` with responsive desktop/mobile framing (`100dvh` & safe-area inset aware).
- **5 Seamless Altitude Biomes:** Twilight Skyline → Aurora Canopy → Stratosphere → Orbital Horizon → Deep Nova, complete with parallax aurora ribbons, clouds, ringed planet, and shooting comets.
- **Tactile Game Feel:** Volume-preserving squash & stretch, reactive jet-boots & blinking visor eyes, screen-wrap ghost rendering, recoil & crumbling debris, animated coil springs, shockwave rings, speed lines, hit-stop on drone smash, and `prefers-reduced-motion` support.
- **Fair Procedural Generation:** Reachability-aware horizontal placement, fragile-platform streak caps, gentle magnetic pickup pull, and safe drone spacing.

## Run locally

```sh
npm run dev
```

Open http://127.0.0.1:3000/.

## Tests

```sh
npm test
# or directly:
node scripts/smoke.mjs
```

## Release

Cloudflare Pages uses `wrangler.jsonc` with `pages_build_output_dir: "./public"`. For portal ZIP submissions (itch.io, Poki, CrazyGames, GameDistribution), package `public/index.html` directly at the ZIP root.

## CrazyGames Basic Launch build

Run `npm run build:crazygames` and zip `dist/crazygames/index.html` at the archive root. This build omits the in-game fullscreen control and leaves Escape available to the host. It uses local progress and contains no advertising integration. The Cloudflare Pages build continues to use `public/`.

Run `npm test` and `node scripts/smoke.mjs dist/crazygames/index.html` to exercise the standalone and portal variants.
