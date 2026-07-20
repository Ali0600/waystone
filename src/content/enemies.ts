import type { GlyphId } from './glyphs'

/**
 * Three enemy archetypes, readable from silhouette + colour alone (v1 §6):
 * the hunched Husk hits in melee strings, the tall Warden casts parryable
 * bolts (reflect at Parry T2), the bell-shaped Chorister chants Locks.
 */
export type EnemyArchetype = 'husk' | 'warden' | 'chorister'

export interface EnemyAttack {
  name: string
  /** 'melee' beats are each parryable; 'projectile' reflects at Parry T2;
   *  'chant' shows Locks that matching glyph actions break. */
  pattern: 'melee' | 'projectile' | 'chant'
  damage: number
  /** Seconds of telegraph before the first hit. */
  windup: number
  /** Hit times after windup (melee strings). Single hit if omitted. */
  beats?: number[]
  /** Chant locks (glyph types that break them). */
  locks?: GlyphId[]
}

export interface EnemyDef {
  id: string
  name: string
  archetype: EnemyArchetype
  color: string
  hp: number
  lumenReward: number
  attacks: EnemyAttack[]
}

export const ENEMIES: Record<string, EnemyDef> = {
  husk: {
    id: 'husk',
    name: 'Amber Husk',
    archetype: 'husk',
    color: '#b8543f',
    hp: 26,
    lumenReward: 12,
    attacks: [
      {
        name: 'Cinder Swipe',
        pattern: 'melee',
        damage: 4,
        windup: 1.1,
        beats: [0, 0.55],
      },
      {
        name: 'Ember Flurry',
        pattern: 'melee',
        damage: 3,
        windup: 1.3,
        beats: [0, 0.4, 0.8],
      },
    ],
  },
  warden: {
    id: 'warden',
    name: 'Pale Warden',
    archetype: 'warden',
    color: '#8fb8d8',
    hp: 30,
    lumenReward: 16,
    attacks: [
      {
        name: 'Vigil Bolt',
        pattern: 'projectile',
        damage: 6,
        windup: 1.4,
      },
      {
        name: 'Twin Vigil',
        pattern: 'melee',
        damage: 4,
        windup: 1.2,
        beats: [0, 0.7],
      },
    ],
  },
  chorister: {
    id: 'chorister',
    name: 'Hollow Chorister',
    archetype: 'chorister',
    color: '#8a6fae',
    hp: 34,
    lumenReward: 22,
    attacks: [
      {
        name: 'Unfinished Verse',
        pattern: 'chant',
        damage: 14,
        windup: 1.6,
        locks: ['ember', 'gale'],
      },
      {
        name: 'Toll',
        pattern: 'melee',
        damage: 5,
        windup: 1.2,
        beats: [0],
      },
    ],
  },
  'husk-elder': {
    id: 'husk-elder',
    name: 'Elder Husk',
    archetype: 'husk',
    color: '#8f3b2c',
    hp: 40,
    lumenReward: 30,
    attacks: [
      {
        name: 'Grave Swipe',
        pattern: 'melee',
        damage: 5,
        windup: 1.0,
        beats: [0, 0.5, 1.0],
      },
      {
        name: 'Buried Verse',
        pattern: 'chant',
        damage: 12,
        locks: ['stone'],
        windup: 1.5,
      },
    ],
  },
}

export interface EnemySpawnDef {
  enemyId: string
  x: number
  z: number
  /** Wander radius around the spawn point. */
  patrolR: number
  /** Defeating this spawn unlocks the guarded discoverable. */
  guards?: string
}
