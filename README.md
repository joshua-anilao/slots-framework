# Slots Framework

A framework for prototyping slot games fast (HTML5) and building them for production (Cocos Creator), sharing one TypeScript math engine.

## Quick start

```bash
npm install
npm test                                   # unit tests + a quick RTP band check
npm run sim -- games/game-001              # simulate 1M rounds, writes games/game-001/reports/A/report.html
```

Needs Node 22.17+.

## Docs
- [FRAMEWORK_SPEC.md](FRAMEWORK_SPEC.md): goals, two tracks, architecture, decisions
- [PLAN.md](PLAN.md): build phases
- [docs/MATH_ENGINE_GUIDE.md](docs/MATH_ENGINE_GUIDE.md): slot math explained
- [docs/SCREENS_AND_FEATURES.md](docs/SCREENS_AND_FEATURES.md): standard game screens and numbered features
- [guides/](guides/): programming, art and design guides

## Packages
- [packages/math-core](packages/math-core/README.md): the engine
- [packages/game-logic](packages/game-logic/README.md): shared models, controllers, services
- [packages/simulator](packages/simulator/README.md): RTP report and PAR sheet
