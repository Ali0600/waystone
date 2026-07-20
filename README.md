# Waystone

A browser third-person exploration RPG built on Three.js. You are the last **Surveyor**
in a world that was sung into being — and the song stopped partway. Plant Waystones to
finish what the song abandoned, bring the people you find out there home, and watch home
grow.

**Play (latest main build): <https://ali0600.github.io/waystone/>**

> Status: early development — currently at **M0** (renderer bootstrap) of the MVP
> vertical slice.

## Design

One pillar, applied as an acceptance test to every feature:

> **A world that rewards exploration, where everything has upgrades.**

- Compact and dense, never vast: hand-built regions, no open world, no procedural terrain.
- Everything you *do* levels itself — no XP screen. Verbs, tools and even minigames have
  their own progress tracks.
- Every discoverable pays out on **at least two meters** at once.
- No permanent missables, no unhinted secrets, no endurance-as-difficulty.

Derived from a personal JRPG design-research codex (162 mechanics across 34 games).

## Stack

- [Three.js](https://threejs.org/) (WebGL renderer, `MeshToonMaterial` toon shading)
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) for collision (no physics engine)
- Vite + TypeScript, vanilla DOM/CSS for UI — no framework
- Vitest (logic + content-invariant tests), GitHub Actions CI deploying to GitHub Pages

## Development

```bash
npm ci
npm run dev        # dev server at http://localhost:5173/waystone/
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # production build to dist/
```

CI runs typecheck + tests + build on every PR; merges to `main` deploy to GitHub Pages
only after tests pass.
