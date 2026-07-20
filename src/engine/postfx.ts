import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

/** Subtle dusk vignette — one cheap fullscreen pass. */
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.42 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float vignette = 1.0 - dot(d, d) * strength * 2.0;
      gl_FragColor = vec4(color.rgb * vignette, color.a);
    }
  `,
}

/**
 * The single post chain: render + slight bloom + vignette. The render pass
 * is retargeted per frame so the arena shares it.
 */
export class PostFx {
  private composer: EffectComposer
  private renderPass: RenderPass

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.composer = new EffectComposer(renderer)
    this.renderPass = new RenderPass(scene, camera)
    this.composer.addPass(this.renderPass)
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.32, // strength — a lantern-glow whisper, not a searchlight
      0.6,
      0.78,
    )
    this.composer.addPass(bloom)
    this.composer.addPass(new ShaderPass(VignetteShader))
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height)
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderPass.scene = scene
    this.renderPass.camera = camera
    this.composer.render()
  }
}
