# Background video

Drop looping forest clips here and the scenes play them automatically.
Each scene tries `.webm` first, then `.mp4`. Without a clip, the scene shows
the photo from `assets/photos/` (if any), then the drawn landscape.

| File | Where it plays |
|---|---|
| `forest-hero.webm` / `forest-hero.mp4` | Homepage top section |
| `forest-lake.webm` / `forest-lake.mp4` | Homepage quote section and admin login |

Tips for a smooth, light background:

- 10–20 seconds that loop cleanly, no audio track (it plays muted anyway)
- 1920×1080 or 1280×720, ideally under 4–6 MB per file
- Slow, calm footage: mist moving through trees, sunlight through the canopy, gentle water
- Also put a still from the clip in `assets/photos/` (same scene) so it shows instantly while the video loads
- Use clips you have the rights to (your own campaign footage, or Pexels / Pixabay / Mixkit free licences)

Video is skipped for visitors with reduced motion or data saver turned on, and pauses when scrolled off-screen.
