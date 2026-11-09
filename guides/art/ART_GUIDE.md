# Art Guide

Default look and asset rules. Per-game differences go in `games/<id>/guides/art.md`. Each game's own mood board and palette go in `games/<id>/theme/`.

## 1. General look (default)

- **Genre feel:** premium Asian-casino style. Rich, warm, high-contrast; gold trims; glowing UI on a dark-to-mid background so symbols pop.
- **Readability first:** symbols must be recognisable at phone size in under half a second. Strong silhouettes, distinct colors per symbol tier.
- **Symbol tiers:** low (card ranks/suits) muted; high (characters/icons) saturated; special (Wild, Scatter, Golden) with glow/animated frame.
- **UI:** big, thumb-reachable spin button bottom-center; controls bottom; win/balance always visible.
- **Every game's art must be original** (own name, logo, symbols, characters). References from other games are for genre and layout only.

**Reference images:** see `guides/art/references/` (mood, ui, symbols, fx, layout). Claude looks at these before any art or UI work. Per-game references go in `games/<id>/guides/art/references/`.

## 2. Atlases (re-skin friendly)

Group related art into atlases so a re-skin = swapping atlas files with the **same frame names**.

| Atlas | Contents |
|---|---|
| `symbols` | All symbol statics (normal + golden versions) |
| `symbols_fx` | Symbol win/pop frame animations (if not Spine) |
| `ui_main` | Buttons, bet panel, balance/win boxes, icons (wifi, settings, auto, turbo) |
| `ui_popups` | Popup frames, buy bonus, settings, history, tutorial |
| `frame` | Reel frame, multiplier bar, logo area |
| `fx_bigwin` | Big/Super/Ultra win titles, coins, sparkles (lazy-loaded) |
| `freespins` | Free spins backgrounds, intro/outro (lazy-loaded) |
| `loading` | Loading screen art, banner, bar (boot) |

Rules:
- Max atlas page 2048×2048; power-of-two; 2–4 px padding/extrude.
- Fonts for numbers as **bitmap fonts** (win amounts, balance) in their own atlas.
- Backgrounds are separate full images, not in atlases.
- **Frame names are the contract.** e.g. `sym_K.png`, `sym_K_gold.png`, `btn_spin_normal.png`, `btn_spin_pressed.png`. A theme must provide every name in `games/<id>/theme/manifest.json` (missing names fall back to placeholders and are reported).

## 3. Sizes and formats

- Design resolution 720×1280 portrait. Deliver art at 2x of on-screen size where it will be scaled down; no upscaling.
- Symbol cell ~ 128×150 on screen → deliver 256×300.
- Source: PSD/AI kept in `games/<id>/theme/source/` (or external drive, not shipped). Exports: PNG with transparency.
- Build compresses to WebP/ASTC automatically; artists deliver PNG.

## 4. Spine readiness

We may use Spine later, so:
- Every animated element has a **SymbolView / FxView interface** with two implementations: `SpriteSymbolView` (frames from atlas) and `SpineSymbolView` (Spine skeleton). Theme manifest says which per symbol.
- Spine naming: skeleton `sym_K`, animations `idle`, `win`, `pop`, `land`, `to_wild`. Same names for every symbol so code never changes.
- Spine export version pinned per project (match Cocos 3.8's supported runtime); JSON or binary `.skel` + atlas.
- HTML prototype uses sprite views only (Spine optional later via pixi-spine if needed).

## 5. Placeholders

The framework ships a **placeholder theme** (colored shapes + text labels with the right frame names) so math and flow can be played before any art exists.

## 6. Delivery checklist (artist)

- [ ] All manifest frame names present
- [ ] Golden variant for every symbol that can be golden
- [ ] Spin button states: normal, pressed, disabled, spinning, auto-active
- [ ] Bitmap font digits 0–9, `₱ , . x` signs
- [ ] Logo + loading banner + volatility icon
- [ ] Source files stored
