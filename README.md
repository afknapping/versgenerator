# Versgenerator

Pick a Bible verse, pick a mountain photo, export a styled verse-card image.

Private demo project — no build step, no backend. Plain static HTML/CSS/JS
served as-is (works locally and via GitHub Pages).

## Run locally

```
python3 serve.py 8080
```

(Plain `python3 -m http.server` works too, but its caching makes edits
appear stale during development - `serve.py` disables that.)

Then open http://localhost:8080. On first load, paste a free
[Unsplash Access Key](https://unsplash.com/developers) into the settings
panel — it's stored only in this browser's `localStorage`, never committed.

## Data

- `data/schlachter2000.json` — vendored from
  [afknapping/Schlachter2000-json](https://github.com/afknapping/Schlachter2000-json).
  For private use only (Schlachter 2000 text is copyrighted).
- `data/kjv.json` — vendored from
  [farskipper/kjv](https://github.com/farskipper/kjv) (public domain).
