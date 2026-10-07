# Motion graphics

`scene.html` draws three animated scenes on a canvas, frame by frame:

| Mode | Output | Use |
|---|---|---|
| `morning` | `assets/video/forest-hero.mp4` / `.webm` | Homepage hero background (misty morning forest, sun rays, birds, dust in the light) |
| `sunset` | `assets/video/forest-lake.mp4` / `.webm` | Homepage quote section and admin login (sunset lake with reflections, reeds, fireflies) |
| `promo` | `royalty-nexus-promo-1080p.mp4` | 26-second branded promo with titles, for social media and presentations |

The background loops are 20 seconds and loop seamlessly: every movement repeats exactly every 20 seconds.

## Preview

Serve the repository root (`python3 -m http.server 8000`) and open
`http://localhost:8000/tools/motion/scene.html?mode=morning`. In the browser console, call `render(5)` to draw the frame at 5 seconds.

## Render

```bash
python3 -m http.server 8000 &          # from the repository root
node tools/motion/render.js all        # or morning | sunset | promo
```

You need Playwright with Chromium and ffmpeg. If ffmpeg isn't on your PATH, set `FFMPEG=/path/to/ffmpeg`. Running `pip install imageio-ffmpeg` gives you one.

The promo text, timings and colours are in `drawPromo()` in `scene.html`.
