# sequential-interaction-prototype
Codebasefor my sequential interaction project in IXD 107-03, working with claude code

## Live site
https://yititsai.github.io/sequential-interaction-prototype/

GitHub Pages publishes from the `main` branch, `/docs` folder
(Settings → Pages → Deploy from a branch → `main` / `/docs`).

## Monster's Journey — sequence prototype
One continuous, linear interaction built from the four studies in `interaction-studies.zip`.
Each step unlocks only after the previous one succeeds:

1. **Wake** (Wake the Monster) — press and release the dormant monster (or Space/Enter). It wakes and sends out a ripple.
2. **Glide** (Glide to Steer) — move the pointer left/right (or arrow keys) to float the monster over the mark on the floor and hold it there for 1 s.
3. **Steer + Fire** (Steer + Fire) — arrow keys or on-screen keys to move and jump, Space to fire. Climb to the top bar to light the target, then hit it.
4. **Burst** (Charge + Burst) — hold two fingers, the mouse button, or Space for 1 s to charge and burst onto the upper platform.

Ending: the monster arrives, a final ripple leaves it, and "The monster made it." appears with a **Start over** button that returns to the dormant monster.

### Files
Plain HTML/CSS/JS with no build step; `/docs` is both the source and the published site.

- `docs/index.html` — page
- `docs/css/style.css` — shared light/dark tokens, hint, key caps, ending
- `docs/js/core.js` — canvas, theme colors, monster art, ripple
- `docs/js/stages/*.js` — one file per study (wake, glide, fire, burst)
- `docs/js/sequence.js` — linear sequencer, handoffs, input routing, ending/reset

Run locally by opening `docs/index.html` in a browser.
