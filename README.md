# sequential-interaction-prototype
Codebasefor my sequential interaction project in IXD 107-03, working with claude code

## Live site
https://yititsai.github.io/sequential-interaction-prototype/

GitHub Pages publishes from the `main` branch, `/docs` folder
(Settings → Pages → Deploy from a branch → `main` / `/docs`).

## Monster Mayhem with the Monster's Journey tutorial
`docs/index.html` is the full **Monster Mayhem** game with the four interaction studies played first as a tutorial.
Each step unlocks only after the previous one succeeds, and then the original game starts directly.

1. **Wake the Monster** (spongy): click the sleeping monster on the title screen. It squishes, rebounds with an overshoot and sends out a ripple.
2. **Steer + Fire** (snappy): use the real game controls in a practice area: ← →, ↑ to jump, Space to attack. Use each one and hit the practice target.
3. **Glide to Steer** (light): grab the wings to start Flying Mode. Arrow keys switch off and the mouse steers with the glide study's spring and lean. Fly through ring 1 (right), ring 2 (left), then land on the checkpoint.
4. **Charge + Burst** (springy): hold the mouse button (or two fingers on a touchscreen). The monster swells, trembles and bursts up to the EXIT. Releasing early cancels the charge.

After **TUTORIAL COMPLETE!** the original game begins at Section 1, with all of its levels, enemies, scoring, health, power-ups, Flying Mode, boost, sounds, game over/retry and win screen unchanged.
Dying uses the game's normal retry. The **↺ Restart** button (top right) goes back to Tutorial Step 1; during the main game it asks first.

### Refinement controls (Week 5)
A **⚙ REFINEMENT CONTROLS** tab (top-left, or press the ` key) opens a design-tool panel that tunes the four behavioural qualities live:
- **Wake / Spongy:** squash amount, rebound overshoot
- **Movement / Snappy:** response/acceleration, lean/stretch
- **Flying / Light:** mouse follow ease, floating/bob
- **Charge + Burst / Springy:** charge duration, growth, boost strength

Presets: **V1 Subtle**, **V2 Balanced** (= final settings) and **V3 Exaggerated**. There's also **Reset to Final Settings** and **Copy values** (for documentation).
**Preview Behavior** (inside the panel) pauses the game and shows a demo scene for screenshots, using the live values:
- **Spongy Wake:** a squish loop plus rest / max squash / peak overshoot poses against a rest-height line
- **Snappy Movement:** afterimages every 0.08 s plus a speed-over-time graph
- **Light Flying:** a dotted path showing lag, overshoot and bob
- **Springy Charge:** a charge → burst loop with burst-apex and exit-ledge lines, plus **Hold at 80% Charge**, which freezes the pose with ring, aura and size numbers

**Exit preview** resumes the game exactly where it was.
Settings never change the tutorial order, completion rules or controls, and the tutorial burst always clears the exit.

### Files
- `docs/index.html`: the combined game (single file, like the original). The tutorial is the `TUTORIAL` section of the script.
- `docs/journey/`: the earlier grayscale Monster's Journey sequence (https://yititsai.github.io/sequential-interaction-prototype/journey/)
- `docs/steer-fire.html`: the Steer + Fire study with Behavior Controls
- `source/`: the original uploads (`Monster Mayhem.html`, `Monsters Journey.zip`) kept for reference
- `interaction-studies.zip`: the four original interaction studies

No build step. Open `docs/index.html` in a browser to run it locally.
