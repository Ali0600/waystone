import { ARTS, type ArtDef } from '../content/chains'

const SEQUENCE_WINDOW = 1.6

/**
 * Watches raw key-press order for Hidden Art sequences. Deliberately
 * undocumented in the UI — knowledge is a reward.
 */
export class ArtRecognizer {
  private buffer: { code: string; t: number }[] = []

  /** Feed this step's pressed codes; returns a completed art, if any. */
  push(codes: string[], t: number): ArtDef | null {
    for (const code of codes) {
      this.buffer.push({ code, t })
    }
    this.buffer = this.buffer.filter((e) => t - e.t <= SEQUENCE_WINDOW)
    for (const art of ARTS) {
      if (this.matches(art)) {
        this.buffer = []
        return art
      }
    }
    return null
  }

  private matches(art: ArtDef): boolean {
    const n = art.sequence.length
    if (this.buffer.length < n) return false
    const tail = this.buffer.slice(-n)
    return art.sequence.every((code, i) => tail[i].code === code)
  }
}
