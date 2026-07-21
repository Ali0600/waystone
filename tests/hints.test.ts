import { describe, expect, it, vi } from 'vitest'
import { HintSystem } from '../src/progression/hints'
import { HINTS, type HintContext, type HintDef } from '../src/content/hints'
import { createInitialState } from '../src/core/state'
import { ARTS } from '../src/content/chains'
import { COMBOS } from '../src/content/glyphs'

function ctx(over: Partial<HintContext> = {}): HintContext {
  return {
    lanternUses: 0,
    totalVerbUses: 0,
    reachedAnyTier: false,
    glyphStones: 0,
    gridEmpty: true,
    onMist: false,
    uiOpen: false,
    inCombat: false,
    ...over,
  }
}

/** A tiny two-hint fixture so scheduling tests don't depend on the real set. */
const A: HintDef = { id: 'a', text: 'hint A', when: (c) => c.glyphStones >= 1 }
const B: HintDef = { id: 'b', text: 'hint B', when: (c) => c.onMist, showOnce: true }

describe('HintSystem — scheduling', () => {
  it('shows a hint only after its minElapsedSec, then retires when the player acts', () => {
    const s = new HintSystem(createInitialState())
    // Lantern hint has minElapsedSec 10 and fires while lanternUses === 0.
    expect(s.update(ctx(), 5)).toBeNull() // clock 5 — too early
    expect(s.update(ctx(), 6)).toBe(HINTS[0].text) // clock 11 — shows
    // Player pulses the lantern → when() goes false → retired for good.
    expect(s.update(ctx({ lanternUses: 1 }), 0.1)).toBeNull()
    expect(s.seen('lantern-pulse')).toBe(true)
    // Never returns, even if the trigger condition somehow recurs.
    expect(s.update(ctx(), 60)).toBeNull()
  })

  it('shows one hint at a time and enforces a gap between different hints', () => {
    const s = new HintSystem(createInitialState(), [A, B], undefined, { hold: 8, gap: 20 })
    // Both eligible; only the first (A) shows.
    expect(s.update(ctx({ glyphStones: 1, onMist: true }), 1)).toBe('hint A')
    // Still A while held (not a second concurrent hint).
    expect(s.update(ctx({ glyphStones: 1, onMist: true }), 1)).toBe('hint A')
    // A resolves (glyphStones back to 0) → retired.
    expect(s.update(ctx({ glyphStones: 0, onMist: true }), 0.1)).toBeNull()
    // Gap not yet elapsed → B suppressed even though eligible.
    expect(s.update(ctx({ onMist: true }), 5)).toBeNull()
    // After the gap, B shows.
    expect(s.update(ctx({ onMist: true }), 20)).toBe('hint B')
  })

  it('suppresses hints while a panel or duel owns the screen, and pulls a shown one', () => {
    const s = new HintSystem(createInitialState(), [A], undefined, { hold: 8, gap: 0 })
    expect(s.update(ctx({ glyphStones: 1, uiOpen: true }), 1)).toBeNull() // never starts under UI
    expect(s.update(ctx({ glyphStones: 1 }), 1)).toBe('hint A') // now shows
    expect(s.update(ctx({ glyphStones: 1, inCombat: true }), 0.1)).toBeNull() // pulled by combat
    expect(s.seen('a')).toBe(false) // pulled, not retired
  })

  it('marks a showOnce hint seen after it has been held, even if still relevant', () => {
    const s = new HintSystem(createInitialState(), [B], undefined, { hold: 8, gap: 0 })
    expect(s.update(ctx({ onMist: true }), 1)).toBe('hint B')
    expect(s.update(ctx({ onMist: true }), 9)).toBeNull() // held past 8s → retired
    expect(s.seen('b')).toBe(true) // showOnce ⇒ seen despite onMist still true
  })

  it('keeps an actionable (non-showOnce) hint un-seen after its hold, so it can nudge again', () => {
    const s = new HintSystem(createInitialState(), [A], undefined, { hold: 8, gap: 5 })
    expect(s.update(ctx({ glyphStones: 1 }), 1)).toBe('hint A')
    expect(s.update(ctx({ glyphStones: 1 }), 9)).toBeNull() // stepped aside after hold
    expect(s.seen('a')).toBe(false) // not resolved → still teachable
    expect(s.update(ctx({ glyphStones: 1 }), 6)).toBe('hint A') // re-nudges after the gap
  })

  it('never shows a hint the player pre-empted (markSeen before it could fire)', () => {
    const s = new HintSystem(createInitialState(), [A], undefined, { hold: 8, gap: 0 })
    s.markSeen('a') // e.g. a retireOn bus event fired first
    expect(s.update(ctx({ glyphStones: 1 }), 1)).toBeNull()
    expect(createInitialState().hintsSeen).toEqual([]) // sanity: default is empty
  })

  it('logs each hint exactly once even if it is shown, pulled, and shown again', () => {
    const log = vi.fn()
    const s = new HintSystem(createInitialState(), [A], log, { hold: 8, gap: 0 })
    s.update(ctx({ glyphStones: 1 }), 1) // shows → log
    s.update(ctx({ glyphStones: 1, uiOpen: true }), 0.1) // pulled
    s.update(ctx({ glyphStones: 1 }), 0.1) // shows again — must NOT re-log
    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith('hint A')
  })

  it('persists seen ids into the shared GameState', () => {
    const state = createInitialState()
    const s = new HintSystem(state, [A], undefined, { hold: 8, gap: 0 })
    s.update(ctx({ glyphStones: 1 }), 1)
    s.update(ctx({ glyphStones: 0 }), 0.1) // resolve → seen
    expect(state.hintsSeen).toContain('a')
  })
})

describe('HINTS — data invariants', () => {
  it('has unique ids and non-empty text', () => {
    const ids = HINTS.map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const h of HINTS) expect(h.text.trim().length).toBeGreaterThan(0)
  })

  it('never spoils a Hidden-Art sequence or a glyph-combo recipe', () => {
    const arrows = ['↑', '↓', '←', '→', '␣']
    for (const h of HINTS) {
      // No input-sequence glyphs (Hidden Arts must never be shown).
      for (const a of arrows) {
        expect(h.text.includes(a), `hint "${h.id}" shows an input arrow`).toBe(false)
      }
      // No combo name (adjacency recipes are a discovery).
      for (const c of COMBOS) {
        expect(
          h.text.toLowerCase().includes(c.name.toLowerCase()),
          `hint "${h.id}" names combo "${c.name}"`,
        ).toBe(false)
      }
      // No Hidden-Art name printed alongside would-be instructions.
      for (const art of ARTS) {
        expect(
          h.text.toLowerCase().includes(art.name.toLowerCase()),
          `hint "${h.id}" names art "${art.name}"`,
        ).toBe(false)
      }
    }
  })
})
