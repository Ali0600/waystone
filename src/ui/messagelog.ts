/**
 * The message Log — a rolling record of every bottom-left toast the player has
 * seen this session. Kept PURE (no DOM) so the ring-buffer behaviour is
 * unit-tested in node and the Ledger's Log tab just renders `entries()`.
 *
 * Why it exists: toasts stack at most 5 and evict the oldest, so a burst (a
 * waystone planting emits several at once) scrolls messages away before they
 * can be read. The Toasts choke point records every push here so the Log keeps
 * what the on-screen stack drops. Session-only by design — its job is "what did
 * that toast just say?", which is always in-session; nothing is persisted.
 */

export const MESSAGE_LOG_CAP = 100

export type MessageFlavor = 'reward' | 'info'

export interface LogEntry {
  text: string
  flavor: MessageFlavor
}

export class MessageLog {
  private entriesList: LogEntry[] = []

  /** Record a message. Oldest entries drop once the cap is exceeded. */
  push(text: string, flavor: MessageFlavor = 'info'): void {
    this.entriesList.push({ text, flavor })
    if (this.entriesList.length > MESSAGE_LOG_CAP) this.entriesList.shift()
  }

  /** A defensive copy, oldest → newest (the UI reverses for newest-first). */
  entries(): LogEntry[] {
    return this.entriesList.map((e) => ({ ...e }))
  }
}
