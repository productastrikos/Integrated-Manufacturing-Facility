import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type * as THREE from 'three'

/**
 * A blinking red ring + beacon hovering over whatever object the
 * currently-run scenario points at — shared by every twin object type
 * that can be a scenario target (equipment, a building). Pulses via a
 * sine wave on scale and opacity rather than a fixed animation clip, so
 * it reads as an alert beacon, not a decorative spin.
 */
export function ScenarioTargetPulse({ heightAbove, ringRadius }: { heightAbove: number; ringRadius: number }) {
  const ringRef = useRef<THREE.Mesh>(null)
  const beamRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const pulse = 0.5 + 0.5 * Math.sin(t * 4)
    if (ringRef.current) {
      const s = 1 + pulse * 0.35
      ringRef.current.scale.set(s, s, s)
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.35 + pulse * 0.65
    }
    if (beamRef.current) {
      const mat = beamRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.15 + pulse * 0.35
    }
  })

  return (
    <group position={[0, heightAbove, 0]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringRadius * 0.8, ringRadius, 32]} />
        <meshBasicMaterial color="#ff3b3b" transparent opacity={0.8} side={2} depthWrite={false} />
      </mesh>
      {/* a faint vertical beam so the marker is visible from a distance, not just from directly above */}
      <mesh ref={beamRef} position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2.4, 8]} />
        <meshBasicMaterial color="#ff3b3b" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {/* Labeled in the scene itself, not just in the page banner — a blinking
          red ring alone reads exactly like a real fault indicator, and this
          is a hypothetical the Simulation page computed, not something that
          has actually happened to this object. */}
      <Html position={[0, 2.6, 0]} center distanceFactor={30} occlude={false}>
        <div className="twin-hover-tooltip" style={{ borderColor: '#ff3b3b', pointerEvents: 'none' }}>
          <div className="twin-hover-tooltip-title" style={{ color: '#ff3b3b' }}>
            ◆ Scenario Preview
          </div>
          <div className="twin-hover-tooltip-row">What-if only — not a real fault</div>
        </div>
      </Html>
    </group>
  )
}
