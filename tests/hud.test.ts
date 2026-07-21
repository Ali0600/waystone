import { describe, expect, it } from 'vitest'
import { clickHintHidden } from '../src/ui/hud'

/**
 * The "Click to look around" hint had two writers (pointer-lock via
 * `style.display`, combat via the `hidden` attribute) that desynced and made
 * the centered box snap back after every battle. `clickHintHidden` is now the
 * single source of truth; these pin its logic without a DOM.
 *
 * Args: (wantClickHint = pointer unlocked, worldUiSuppressed = duel/overlay,
 * lookLearned = has locked at least once).
 */
describe('clickHintHidden', () => {
  it('shows only when unlocked, not suppressed, and not yet learned', () => {
    expect(clickHintHidden(true, false, false)).toBe(false)
  })

  it('hides while the pointer is locked (nothing to prompt)', () => {
    expect(clickHintHidden(false, false, false)).toBe(true)
  })

  it('hides while a duel/overlay suppresses the world HUD', () => {
    // Even if the pointer is unlocked, combat owns the screen.
    expect(clickHintHidden(true, true, false)).toBe(true)
  })

  it('once learned, stays hidden regardless of lock/suppression state', () => {
    // The learn-once guarantee: after the first lock the hint never returns.
    expect(clickHintHidden(true, false, true)).toBe(true) // unlocked in the world
    expect(clickHintHidden(true, true, true)).toBe(true) // during combat
    expect(clickHintHidden(false, false, true)).toBe(true) // locked
  })

  it('REGRESSION: combat-end (suppression lifts) must not resurrect a learned hint', () => {
    // The reported bug: endEncounter() lifted worldUiSuppressed and the box
    // reappeared. With learn-once, a player who has ever locked stays clean.
    const duringFight = clickHintHidden(true, true, true)
    const afterFight = clickHintHidden(true, false, true) // suppression lifted
    expect(duringFight).toBe(true)
    expect(afterFight).toBe(true) // still hidden — no snap-back
  })

  it('full truth table: lookLearned OR suppressed OR locked ⇒ hidden', () => {
    for (const want of [false, true]) {
      for (const suppressed of [false, true]) {
        for (const learned of [false, true]) {
          const expected = learned || suppressed || !want
          expect(clickHintHidden(want, suppressed, learned), `${want},${suppressed},${learned}`).toBe(
            expected,
          )
        }
      }
    }
  })
})
