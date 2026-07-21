import type { EventBus } from '../core/events'
import type { GameState } from '../core/state'
import { cardById, type CardDef } from '../content/cards.schema'
import {
  DECK_LIMIT,
  deckCards,
  opponents,
  ownedCards,
  recordMatchResult,
  setDeck,
  type Opponent,
} from '../cards/game'
import {
  chooseMove,
} from '../cards/ai'
import {
  createMatch,
  laneTotal,
  legalMoves,
  pass,
  play,
  type MatchState,
} from '../cards/rules'
import { mulberry32 } from '../core/rng'

type Mode = 'menu' | 'play' | 'deck' | 'result'

/**
 * The Painted Table — the deck game's UI. Opens beside Tam. Drives the pure
 * rules engine (rules.ts) and the greedy AI (ai.ts); owns no rules itself.
 * The overlay is toggled with the `hidden` attribute; its `display:` rule
 * ships the `[hidden]{display:none}` guard in style.css.
 */
export class CardTable {
  private overlay: HTMLElement
  private body: HTMLElement
  visible = false
  private mode: Mode = 'menu'
  private match: MatchState | null = null
  private opp: Opponent | null = null
  private selectedCardId: string | null = null
  private matchSeed = 1
  private lastReward: string | null = null

  constructor(
    private state: GameState,
    private bus: EventBus,
  ) {
    this.overlay = document.createElement('div')
    this.overlay.className = 'esc-overlay card-overlay'
    this.overlay.hidden = true
    const title = document.createElement('div')
    title.className = 'map-title'
    title.textContent = 'The Painted Table'
    this.body = document.createElement('div')
    this.body.className = 'card-body'
    this.overlay.append(title, this.body)
    document.body.appendChild(this.overlay)
    // Escape closes the table first; the Esc menu skips opening beneath it.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.visible) {
        this.close()
        e.stopImmediatePropagation()
      }
    })
  }

  /** For QA: the live match, if one is in progress. */
  get liveMatch(): MatchState | null {
    return this.match
  }

  open(): void {
    this.visible = true
    this.overlay.hidden = false
    this.mode = 'menu'
    this.match = null
    this.opp = null
    document.exitPointerLock?.()
    this.render()
  }

  close(): void {
    this.visible = false
    this.overlay.hidden = true
  }

  toggle(): void {
    if (this.visible) this.close()
    else this.open()
  }

  // --- Rendering -------------------------------------------------------------

  private render(): void {
    this.body.replaceChildren()
    if (this.mode === 'menu') this.renderMenu()
    else if (this.mode === 'play') this.renderPlay()
    else if (this.mode === 'deck') this.renderDeck()
    else if (this.mode === 'result') this.renderResult()
  }

  private button(label: string, onClick: () => void, cls = 'glyph-pick'): HTMLButtonElement {
    const b = document.createElement('button')
    b.className = cls
    b.textContent = label
    b.addEventListener('click', onClick)
    return b
  }

  private cardEl(
    card: { id: string; power: number; cost: number; ability?: CardDef['ability'] },
    opts: { onClick?: () => void; selected?: boolean } = {},
  ): HTMLElement {
    const name = cardById(card.id)?.name ?? card.id
    const el = document.createElement(opts.onClick ? 'button' : 'div')
    el.className = 'pcard' + (opts.selected ? ' pcard-selected' : '')
    el.innerHTML =
      `<span class="pcard-cost">◇${card.cost}</span>` +
      `<span class="pcard-power">${card.power}</span>` +
      `<span class="pcard-name">${name}</span>` +
      (card.ability ? `<span class="pcard-ability">${card.ability}</span>` : '')
    if (opts.onClick) el.addEventListener('click', opts.onClick)
    return el
  }

  private renderMenu(): void {
    const deckSize = this.state.deck.length
    const info = document.createElement('div')
    info.className = 'glyph-status'
    info.textContent =
      deckSize === 0
        ? 'You have no deck yet — Tam deals you in when you first sit down.'
        : `Deck: ${deckSize}/${DECK_LIMIT} · Owned: ${this.state.cardsOwned.length} · pick an opponent.`
    this.body.appendChild(info)

    const list = document.createElement('div')
    list.className = 'card-opplist'
    for (const opp of opponents(this.state)) {
      const wins = this.state.cardWins[opp.id] ?? 0
      const row = this.button(
        `${opp.rival ? '★ ' : ''}${opp.name}${wins > 0 ? `  (won ${wins})` : ''}`,
        () => this.startMatch(opp),
      )
      if (opp.rival) row.classList.add('card-rival')
      list.appendChild(row)
    }
    if (opponents(this.state).length === 0) {
      const none = document.createElement('div')
      none.className = 'glyph-status'
      none.textContent = 'No one is here to play yet. Bring the Waystation to life.'
      list.appendChild(none)
    }
    this.body.appendChild(list)

    const foot = document.createElement('div')
    foot.className = 'card-foot'
    foot.append(
      this.button('Build deck', () => {
        this.mode = 'deck'
        this.render()
      }),
      this.button('Leave', () => this.close()),
    )
    this.body.appendChild(foot)
  }

  private startMatch(opp: Opponent): void {
    const playerDeck = deckCards(this.state)
    if (playerDeck.length < 3) {
      this.bus.emit('toast', { text: 'Build a deck of at least 3 cards first (Build deck).', flavor: 'info' })
      return
    }
    const oppDeck = opp.deckIds.map(cardById).filter((c): c is CardDef => c !== undefined)
    this.opp = opp
    this.matchSeed = (this.matchSeed + 0x9e37) >>> 0
    this.match = createMatch(playerDeck, oppDeck, mulberry32(this.matchSeed))
    this.mode = 'play'
    this.selectedCardId = null
    this.render()
  }

  private renderPlay(): void {
    const m = this.match!
    const opp = this.opp!
    const head = document.createElement('div')
    head.className = 'glyph-status'
    head.textContent = `vs ${opp.name} — your motes: ◇${m.motes.p} · ${opp.name}: ◇${m.motes.o}`
    this.body.appendChild(head)

    const lanes = document.createElement('div')
    lanes.className = 'card-lanes'
    for (let i = 0; i < m.lanes.length; i++) {
      const lane = document.createElement('div')
      lane.className = 'card-lane'
      const ot = laneTotal(m.lanes[i].o, m.lanes[i].p)
      const pt = laneTotal(m.lanes[i].p, m.lanes[i].o)
      const oppRow = document.createElement('div')
      oppRow.className = 'card-row card-row-opp'
      for (const c of m.lanes[i].o) oppRow.appendChild(this.cardEl(c))
      const mid = document.createElement('div')
      mid.className = 'card-lane-mid'
      mid.textContent = `${pt} — ${ot}` + (pt > ot ? '  ◀ you' : ot > pt ? '  opp ▶' : '  tie')
      const myRow = document.createElement('div')
      myRow.className = 'card-row card-row-me'
      for (const c of m.lanes[i].p) myRow.appendChild(this.cardEl(c))
      // A selected hand card can be dropped into this lane.
      if (this.selectedCardId && m.turn === 'p' && !m.done) {
        const drop = this.button('▾ play here', () => this.playSelected(i), 'card-drop')
        myRow.appendChild(drop)
      }
      lane.append(oppRow, mid, myRow)
      lanes.appendChild(lane)
    }
    this.body.appendChild(lanes)

    // Player hand.
    const hand = document.createElement('div')
    hand.className = 'card-hand'
    for (const c of m.hands.p) {
      const affordable = c.cost <= m.motes.p && m.turn === 'p' && !m.done
      const el = this.cardEl(c, {
        selected: this.selectedCardId === c.id,
        onClick: affordable ? () => this.selectCard(c.id) : undefined,
      })
      if (!affordable) el.classList.add('pcard-dim')
      hand.appendChild(el)
    }
    this.body.appendChild(hand)

    const foot = document.createElement('div')
    foot.className = 'card-foot'
    const status = document.createElement('span')
    status.className = 'glyph-status'
    status.textContent =
      m.turn === 'p' ? (this.selectedCardId ? 'Choose a lane above.' : 'Your turn — play a card or pass.') : '…'
    foot.appendChild(status)
    foot.appendChild(this.button('Pass', () => this.playerPass()))
    this.body.appendChild(foot)
  }

  private selectCard(id: string): void {
    this.selectedCardId = this.selectedCardId === id ? null : id
    this.render()
  }

  private playSelected(lane: number): void {
    if (!this.match || !this.selectedCardId) return
    if (play(this.match, 'p', this.selectedCardId, lane)) {
      this.selectedCardId = null
      this.runOpponent()
    }
    this.afterTurn()
  }

  private playerPass(): void {
    if (!this.match) return
    pass(this.match, 'p')
    this.selectedCardId = null
    if (!this.match.done) this.runOpponent()
    this.afterTurn()
  }

  /** Let the opponent act until the turn returns to the player or it ends. */
  private runOpponent(): void {
    const m = this.match!
    let guard = 0
    while (!m.done && m.turn === 'o' && guard++ < 100) {
      const move = chooseMove(m, 'o')
      if (move === null) pass(m, 'o')
      else play(m, 'o', move.cardId, move.lane)
    }
    // If neither side can move, force scoring.
    if (!m.done && legalMoves(m, 'p').length === 0 && legalMoves(m, 'o').length === 0) {
      pass(m, 'p')
      if (!m.done) pass(m, 'o')
    }
  }

  private afterTurn(): void {
    if (this.match?.done) this.finishMatch()
    else this.render()
  }

  private finishMatch(): void {
    const m = this.match!
    const opp = this.opp!
    const won = m.winner === 'p'
    const reward = recordMatchResult(this.state, opp, won)
    if (won) {
      this.bus.emit('lumen:changed', { total: this.state.lumen, delta: reward.lumen })
      if (reward.stones > 0) {
        this.bus.emit('glyphstone:changed', { total: this.state.glyphStones, delta: reward.stones })
      }
    }
    const bits: string[] = []
    bits.push(won ? `You win ${m.laneWins.p}–${m.laneWins.o}.` : m.winner === 'draw' ? `A draw, ${m.laneWins.p}–${m.laneWins.o}.` : `You lose ${m.laneWins.p}–${m.laneWins.o}.`)
    if (won) {
      bits.push(`+◆${reward.lumen} Lumen`)
      if (reward.stones > 0) bits.push(`+◇${reward.stones} Glyph Stone${reward.stones > 1 ? 's' : ''}`)
      if (reward.card) bits.push(`New card: ${reward.card.name}!`)
    } else {
      bits.push('Nothing lost — sit again when you like.')
    }
    this.lastReward = bits.join('  ')
    this.mode = 'result'
    this.render()
  }

  private renderResult(): void {
    const msg = document.createElement('div')
    msg.className = 'card-result'
    msg.textContent = this.lastReward ?? ''
    this.body.appendChild(msg)
    if (this.opp?.line) {
      const line = document.createElement('div')
      line.className = 'glyph-status'
      line.textContent = this.opp.line
      this.body.appendChild(line)
    }
    const foot = document.createElement('div')
    foot.className = 'card-foot'
    foot.append(
      this.button('Play again', () => {
        this.mode = 'menu'
        this.render()
      }),
      this.button('Leave', () => this.close()),
    )
    this.body.appendChild(foot)
  }

  private renderDeck(): void {
    const info = document.createElement('div')
    info.className = 'glyph-status'
    info.textContent = `Deck ${this.state.deck.length}/${DECK_LIMIT} — click a card to add or remove.`
    this.body.appendChild(info)

    const grid = document.createElement('div')
    grid.className = 'card-hand card-collection'
    const owned = ownedCards(this.state)
    if (owned.length === 0) {
      const none = document.createElement('div')
      none.className = 'glyph-status'
      none.textContent = 'You own no cards yet.'
      this.body.appendChild(none)
    }
    for (const c of owned) {
      const inDeck = this.state.deck.includes(c.id)
      const el = this.cardEl(c, { selected: inDeck, onClick: () => this.toggleDeckCard(c.id) })
      grid.appendChild(el)
    }
    this.body.appendChild(grid)

    const foot = document.createElement('div')
    foot.className = 'card-foot'
    foot.append(
      this.button('Done', () => {
        this.mode = 'menu'
        this.render()
      }),
    )
    this.body.appendChild(foot)
  }

  private toggleDeckCard(id: string): void {
    const deck = this.state.deck.includes(id)
      ? this.state.deck.filter((d) => d !== id)
      : [...this.state.deck, id]
    if (!setDeck(this.state, deck) && deck.length > this.state.deck.length) {
      this.bus.emit('toast', { text: `A deck holds at most ${DECK_LIMIT} cards.`, flavor: 'info' })
    }
    this.render()
  }
}
