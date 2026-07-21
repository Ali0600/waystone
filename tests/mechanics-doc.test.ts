import { describe, expect, it } from 'vitest'
import doc from '../docs/MECHANICS.md?raw'

/**
 * The meta-gate that keeps docs/MECHANICS.md honest, both directions:
 *  1. every `tests/*.test.ts` the doc cites actually exists (no dead refs);
 *  2. every real test suite is cited by ≥1 mechanic (no orphan suites — a new
 *     milestone's suite forces a new checklist row);
 *  3. every checklist row cites a test OR is tagged `browser-QA` (nothing
 *     ships "covered" with no coverage).
 *
 * Uses Vite's `import.meta.glob` + `?raw` (no node fs, no @types/node) so it
 * typechecks against the browser tsconfig like every other suite.
 */
const SELF = 'mechanics-doc.test.ts'
// Vite's glob omits the importing module itself; union SELF back in (it exists).
const globbed = Object.keys(import.meta.glob('./*.test.ts')).map((p: string) =>
  p.replace(/^\.\//, ''),
)
const testFiles = globbed.includes(SELF) ? globbed : [...globbed, SELF]
const referenced = new Set(
  [...doc.matchAll(/tests\/([\w-]+\.test\.ts)/g)].map((m) => m[1]),
)
const rows = doc.split('\n').filter((l: string) => /^- \[[ x]\] /.test(l))

describe('MECHANICS.md ↔ tests meta-gate', () => {
  it('every test file the doc references exists on disk', () => {
    const missing = [...referenced].filter((r: string) => !testFiles.includes(r))
    expect(missing, `doc references non-existent test files: ${missing.join(', ')}`).toEqual([])
  })

  it('every test suite is referenced by at least one mechanic (no orphans)', () => {
    const orphans = testFiles.filter((f: string) => f !== SELF && !referenced.has(f))
    expect(orphans, `test suites missing from MECHANICS.md: ${orphans.join(', ')}`).toEqual([])
  })

  it('every mechanic row cites a test file or is tagged browser-QA', () => {
    expect(rows.length).toBeGreaterThan(30) // a real, full list
    const uncovered = rows.filter(
      (r: string) => !/tests\/[\w-]+\.test\.ts/.test(r) && !/browser-QA/.test(r),
    )
    expect(uncovered, `rows with no coverage tag:\n${uncovered.join('\n')}`).toEqual([])
  })
})
