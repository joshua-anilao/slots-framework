# Guides

The default rules every game follows. Three guides:

| Folder | What it decides |
|---|---|
| `programming/` | How code is structured: SOLID, MVC, folders, performance budgets, server-ready interfaces |
| `art/` | The general look and how art is delivered: atlases, naming, sizes, Spine readiness |
| `design/` | The general feeling: pacing, juice, win celebrations, sound, UX rules |

## Per-game overrides

A game with a different spec does **not** edit these files. It adds only the differences:

```
games/<game-id>/guides/
  programming.md   (optional) e.g. "landscape only", "boot budget 3s"
  art.md           (optional) e.g. "neon palette", "Spine for all symbols"
  design.md        (optional) e.g. "slower, calmer pacing"
```

Rule: **game override > default guide**. If an override file doesn't mention something, the default applies. Claude reads both before working on a game.
