import { describe, expect, it } from 'vitest'
import { MessageLog, MESSAGE_LOG_CAP } from '../src/ui/messagelog'

describe('MessageLog — session message record', () => {
  it('keeps entries in chronological order with their flavor', () => {
    const log = new MessageLog()
    log.push('first', 'info')
    log.push('+10 Lumen', 'reward')
    log.push('third')
    expect(log.entries()).toEqual([
      { text: 'first', flavor: 'info' },
      { text: '+10 Lumen', flavor: 'reward' },
      { text: 'third', flavor: 'info' }, // default flavor
    ])
  })

  it('caps at MESSAGE_LOG_CAP, dropping the OLDEST', () => {
    const log = new MessageLog()
    for (let i = 0; i < MESSAGE_LOG_CAP + 5; i++) log.push(`msg ${i}`)
    const entries = log.entries()
    expect(entries).toHaveLength(MESSAGE_LOG_CAP)
    // The first 5 are gone; the newest is last.
    expect(entries[0].text).toBe('msg 5')
    expect(entries[entries.length - 1].text).toBe(`msg ${MESSAGE_LOG_CAP + 4}`)
  })

  it('returns a defensive copy — mutating it cannot corrupt the log', () => {
    const log = new MessageLog()
    log.push('kept')
    const snapshot = log.entries()
    snapshot.push({ text: 'injected', flavor: 'info' })
    snapshot[0].text = 'tampered'
    expect(log.entries()).toEqual([{ text: 'kept', flavor: 'info' }])
  })
})
