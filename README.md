# UpJump

Single-file arcade jumper game with collectible stars, combo scoring, drone hazards, and a Nova Dash boost meter.

## Play

- Left / Right arrows or screen edges: move
- Space: Nova Dash when energy reaches 100%
- P: pause
- F: fullscreen

## Local Run

Serve the `public` folder with any static file server.

Example:

```powershell
python -m http.server 8123 --directory public
```

Then open `http://127.0.0.1:8123`.

## Deploy

This project is configured for Cloudflare Pages with [`wrangler.jsonc`](./wrangler.jsonc).
