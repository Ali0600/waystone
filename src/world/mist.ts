import * as THREE from 'three'

export const MIST_Y = -7

/** The mist sea: two slowly drifting translucent discs below every island. */
export class MistSea {
  readonly group = new THREE.Group()
  private readonly upper: THREE.Mesh
  private readonly lower: THREE.Mesh

  constructor(color: string) {
    this.upper = new THREE.Mesh(
      new THREE.CircleGeometry(500, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }),
    )
    this.upper.rotation.x = -Math.PI / 2
    this.upper.position.y = MIST_Y

    const lowerColor = new THREE.Color(color).lerp(new THREE.Color('#1a1626'), 0.35)
    this.lower = new THREE.Mesh(
      new THREE.CircleGeometry(500, 48),
      new THREE.MeshBasicMaterial({ color: lowerColor, transparent: true, opacity: 0.85 }),
    )
    this.lower.rotation.x = -Math.PI / 2
    this.lower.position.y = MIST_Y - 1.4

    this.group.add(this.upper, this.lower)
  }

  update(dt: number): void {
    this.upper.rotation.z += dt * 0.004
    this.lower.rotation.z -= dt * 0.0025
  }
}
