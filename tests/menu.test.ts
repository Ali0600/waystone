import { describe, expect, it } from 'vitest'
import { BattleMenu, type MenuEntry } from '../src/combat/menu'

/**
 * Root layout is stable within a fight:
 *   glyphs=true, fish=N  → [Attack(0), Glyphs(1), Defend(2), Item(3)]
 *   fish=0               → Item(3) present but disabled
 */
function root({ glyphs = true, fish = 0 } = {}): MenuEntry[] {
  const r: MenuEntry[] = [
    {
      key: 'attack',
      label: 'Attack',
      submenu: [
        { key: 'emberwake', label: 'Emberwake', commit: { kind: 'chain', id: 'emberwake' } },
        { key: 'tideturn', label: 'Tideturn', commit: { kind: 'chain', id: 'tideturn' } },
      ],
    },
  ]
  if (glyphs) {
    r.push({
      key: 'glyphs',
      label: 'Glyphs',
      submenu: [{ key: 'ember', label: 'Ember', commit: { kind: 'glyph', id: 'ember' } }],
    })
  }
  r.push({ key: 'defend', label: 'Defend', commit: { kind: 'defend' } })
  r.push({
    key: 'item',
    label: 'Item',
    disabled: fish === 0,
    submenu:
      fish > 0
        ? [{ key: 'mistminnow', label: 'Mistminnow', detail: `×${fish}`, commit: { kind: 'item', fishId: 'mistminnow' } }]
        : [],
  })
  return r
}

const label = (m: BattleMenu, r: MenuEntry[]) => m.view(r).options[m.view(r).cursor].label

describe('BattleMenu — navigation', () => {
  it('starts at Attack; ArrowDown/Up move and wrap', () => {
    const m = new BattleMenu()
    const r = root({ fish: 1 }) // Item enabled so it can be the wrap target
    expect(label(m, r)).toBe('Attack')
    m.step(['ArrowDown'], r)
    expect(label(m, r)).toBe('Glyphs')
    m.step(['ArrowUp'], r) // back to Attack
    m.step(['ArrowUp'], r) // wrap to the bottom (Item)
    expect(label(m, r)).toBe('Item')
  })

  it('skips a disabled entry while navigating', () => {
    const m = new BattleMenu()
    const r = root({ fish: 0 }) // Item disabled
    m.step(['ArrowUp'], r) // up from Attack must skip the disabled Item → Defend
    expect(label(m, r)).toBe('Defend')
  })

  it('Enter descends into a submenu and shows its title', () => {
    const m = new BattleMenu()
    const r = root()
    expect(m.step(['Enter'], r)).toBeNull() // descend into Attack
    const v = m.view(r)
    expect(v.inSubmenu).toBe(true)
    expect(v.title).toBe('Attack')
    expect(v.options.map((o) => o.label)).toEqual(['Emberwake', 'Tideturn'])
  })

  it('Enter on a submenu leaf commits it, then reopens at root', () => {
    const m = new BattleMenu()
    const r = root()
    m.step(['Enter'], r) // into Attack
    m.step(['ArrowDown'], r) // to Tideturn
    expect(m.step(['Enter'], r)).toEqual({ kind: 'chain', id: 'tideturn' })
    expect(m.view(r).inSubmenu).toBe(false)
  })

  it('Defend commits immediately from the root (no submenu)', () => {
    const m = new BattleMenu()
    const r = root()
    m.step(['ArrowDown'], r) // Glyphs
    m.step(['ArrowDown'], r) // Defend
    expect(label(m, r)).toBe('Defend')
    expect(m.step(['Enter'], r)).toEqual({ kind: 'defend' })
  })

  it('Space confirms like Enter — descends into a submenu, then commits a leaf', () => {
    const m = new BattleMenu()
    const r = root()
    // Space descends into Attack (same as Enter)…
    expect(m.step(['Space'], r)).toBeNull()
    expect(m.view(r).inSubmenu).toBe(true)
    expect(m.view(r).title).toBe('Attack')
    // …and Space on a leaf commits it.
    expect(m.step(['Space'], r)).toEqual({ kind: 'chain', id: 'emberwake' })
    expect(m.view(r).inSubmenu).toBe(false)
  })

  it('Space commits a no-submenu root item (Defend)', () => {
    const m = new BattleMenu()
    const r = root()
    m.step(['ArrowDown'], r) // Glyphs
    m.step(['ArrowDown'], r) // Defend
    expect(label(m, r)).toBe('Defend')
    expect(m.step(['Space'], r)).toEqual({ kind: 'defend' })
  })

  it('Esc backs out of a submenu; Esc at root is a no-op (combat can’t be fled)', () => {
    const m = new BattleMenu()
    const r = root()
    m.step(['Enter'], r) // into Attack
    expect(m.view(r).inSubmenu).toBe(true)
    m.step(['Escape'], r)
    expect(m.view(r).inSubmenu).toBe(false)
    m.step(['Escape'], r) // nothing to back out of
    expect(m.view(r).inSubmenu).toBe(false)
  })
})

describe('BattleMenu — WASD double as arrows (M38, one-handed nav)', () => {
  it('KeyW/KeyS move the cursor like ArrowUp/ArrowDown', () => {
    const m = new BattleMenu()
    const r = root() // [Attack, Glyphs, Defend, Item(disabled)]
    expect(label(m, r)).toBe('Attack')
    m.step(['KeyS'], r) // down
    expect(label(m, r)).toBe('Glyphs')
    m.step(['KeyS'], r)
    expect(label(m, r)).toBe('Defend')
    m.step(['KeyW'], r) // up
    expect(label(m, r)).toBe('Glyphs')
  })

  it('KeyW skips a disabled entry, exactly like ArrowUp', () => {
    const m = new BattleMenu()
    const r = root({ fish: 0 }) // Item disabled
    m.step(['KeyW'], r) // up from Attack must skip the disabled Item → Defend
    expect(label(m, r)).toBe('Defend')
  })
})

describe('BattleMenu — Item + Glyphs conditionals + cursor memory', () => {
  it('a disabled Item never receives the cursor and never commits', () => {
    const m = new BattleMenu()
    const r = root({ fish: 0 })
    // Walk the whole root; the cursor must never land on the disabled Item.
    for (let i = 0; i < 6; i++) {
      expect(label(m, r)).not.toBe('Item')
      m.step(['ArrowDown'], r)
    }
  })

  it('a fish Item commits its fishId', () => {
    const m = new BattleMenu()
    const r = root({ fish: 3 })
    m.step(['ArrowDown'], r) // Glyphs
    m.step(['ArrowDown'], r) // Defend
    m.step(['ArrowDown'], r) // Item
    expect(label(m, r)).toBe('Item')
    m.step(['Enter'], r) // into Item submenu
    expect(m.view(r).options[0].detail).toBe('×3')
    expect(m.step(['Enter'], r)).toEqual({ kind: 'item', fishId: 'mistminnow' })
  })

  it('omits Glyphs when none are inscribed', () => {
    const m = new BattleMenu()
    const r = root({ glyphs: false, fish: 0 })
    expect(r.map((e) => e.key)).toEqual(['attack', 'defend', 'item'])
    expect(m.view(r).options.map((o) => o.label)).toEqual(['Attack', 'Defend', 'Item'])
  })

  it('cursor memory: reopens on the last category and sub-option chosen', () => {
    const m = new BattleMenu()
    const r = root()
    m.step(['ArrowDown'], r) // Attack → Glyphs
    m.step(['Enter'], r) // into Glyphs
    expect(m.step(['Enter'], r)).toEqual({ kind: 'glyph', id: 'ember' })
    expect(label(m, r)).toBe('Glyphs') // reopened on Glyphs, not Attack
    m.step(['Enter'], r) // descend again
    expect(m.view(r).cursor).toBe(0) // Ember, remembered
  })
})
