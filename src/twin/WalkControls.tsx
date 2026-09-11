import { PointerLockControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { SITE_GROUND } from './layout'

/**
 * First-person walk-through. Pointer lock handles looking; WASD (or the
 * arrow keys) move the camera across the site at a fixed eye height, with
 * Shift to move faster.
 *
 * Movement is intentionally simple: the camera stays at walking height and
 * is clamped to the site boundary, so the user explores the facility at
 * ground level instead of flying through it. Pressing Escape releases the
 * pointer lock, which exits walk mode via onUnlock.
 */

const EYE_HEIGHT = 1.7
const WALK_SPEED = 14
const RUN_MULTIPLIER = 2.4

/**
 * Where walk mode starts: on the gate approach road, facing down the site
 * toward the production building. Entering from wherever the orbit camera
 * happened to be would routinely drop the user outside the fence looking
 * at empty sky, so the entry pose is fixed and always faces the facility.
 */
const ENTRY_POSITION: [number, number, number] = [0, EYE_HEIGHT, 44]
const ENTRY_LOOK_AT: [number, number, number] = [0, EYE_HEIGHT, 0]

export function WalkControls({ onExit }: { onExit: () => void }) {
  const { camera } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  const forward = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())

  useEffect(() => {
    camera.position.set(...ENTRY_POSITION)
    camera.lookAt(...ENTRY_LOOK_AT)

    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      keys.current = {}
    }
  }, [camera])

  useFrame((_, delta) => {
    const k = keys.current
    const ahead = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)
    const side = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)
    if (!ahead && !side) return

    const speed = WALK_SPEED * (k.ShiftLeft || k.ShiftRight ? RUN_MULTIPLIER : 1) * delta

    // Walk across the ground plane: take the camera's facing direction but
    // flatten it, so looking up or down doesn't lift the camera off the floor.
    camera.getWorldDirection(forward.current)
    forward.current.y = 0
    forward.current.normalize()
    right.current.crossVectors(forward.current, camera.up).normalize()

    camera.position.addScaledVector(forward.current, ahead * speed)
    camera.position.addScaledVector(right.current, side * speed)

    // Stay inside the fence line and at a constant eye height.
    const [gw, gd] = SITE_GROUND
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -gw / 2 + 2, gw / 2 - 2)
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -gd / 2 + 2, gd / 2 - 2)
    camera.position.y = EYE_HEIGHT
  })

  return <PointerLockControls makeDefault onUnlock={onExit} />
}
