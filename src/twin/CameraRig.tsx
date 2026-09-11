import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, type ElementRef } from 'react'
import * as THREE from 'three'
import { SITE_GROUND_HALF, type CameraPreset } from './cameraPresets'

/**
 * Owns the camera. User input (orbit/pan/zoom) goes straight through
 * drei's OrbitControls; a selection change instead eases the camera
 * position and the controls' target toward the new preset, so focusing
 * equipment reads as a deliberate camera move rather than a jump cut.
 *
 * The ease only runs WHILE a transition is in flight. Earlier this ran
 * unconditionally every frame forever, which meant it kept pulling the
 * camera back toward the last preset's exact distance — so zooming in with
 * the scroll wheel got fought and slowly reversed a moment later. Now the
 * transition arms itself on a preset change, disarms once the camera
 * arrives, and disarms immediately if the user so much as touches the
 * controls (drag, wheel, pinch) — their input always wins outright.
 *
 * The very first transition — from the wide INTRO_START position the
 * Canvas mounts with, into the default facility overview — plays as a
 * fixed-duration smoothstep dolly-in (~3.5s, slow-in/slow-out). That's
 * driven by elapsed wall-clock time rather than a per-frame exponential
 * decay: an exponential ease covers most of the distance in its very
 * first fraction of a second no matter how it's tuned, which reads as an
 * instant snap rather than a cinematic move — a fixed-duration curve
 * guarantees the dolly is still visibly in flight partway through,
 * regardless of frame rate. Every transition after that uses the quicker
 * exponential ease (well under a second, still never a hard cut).
 * `introDone` flips permanently once the first transition lands, so the
 * cinematic pace only ever plays once per visit, not on every click.
 */
const NORMAL_LAMBDA = 6.2 // ~0.6–0.8s to arrival, regardless of distance
const INTRO_DURATION_S = 3.5

function smoothstep(t: number) {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

export function CameraRig({ preset }: { preset: CameraPreset }) {
  const controlsRef = useRef<ElementRef<typeof OrbitControls> | null>(null)
  const targetPos = useRef(new THREE.Vector3(...preset.position))
  const targetLook = useRef(new THREE.Vector3(...preset.target))
  const transitioning = useRef(true)
  const introDone = useRef(false)
  const introStartPos = useRef<THREE.Vector3 | null>(null)
  const introStartLook = useRef<THREE.Vector3 | null>(null)
  const introStartTime = useRef<number | null>(null)

  useEffect(() => {
    targetPos.current.set(...preset.position)
    targetLook.current.set(...preset.target)
    transitioning.current = true
  }, [preset])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    // Any user-initiated interaction hands the camera back immediately,
    // mid-transition or not — an in-progress fly-to should never fight a
    // scroll-wheel zoom the user is actively making. It also counts as the
    // intro being "done": if the user grabs the camera during the opening
    // dolly-in, every subsequent move should use the normal quick ease.
    const onStart = () => {
      transitioning.current = false
      introDone.current = true
    }
    controls.addEventListener('start', onStart)
    return () => controls.removeEventListener('start', onStart)
  }, [])

  useFrame((state, delta) => {
    const controls = controlsRef.current
    if (!controls || !transitioning.current) return

    if (!introDone.current) {
      if (introStartTime.current === null) {
        introStartTime.current = state.clock.elapsedTime
        introStartPos.current = state.camera.position.clone()
        introStartLook.current = controls.target.clone()
      }
      const t = smoothstep((state.clock.elapsedTime - introStartTime.current) / INTRO_DURATION_S)
      state.camera.position.lerpVectors(introStartPos.current!, targetPos.current, t)
      controls.target.lerpVectors(introStartLook.current!, targetLook.current, t)
      controls.update()
      if (t >= 1) {
        transitioning.current = false
        introDone.current = true
      }
      return
    }

    const damp = 1 - Math.exp(-NORMAL_LAMBDA * delta) // frame-rate independent ease
    state.camera.position.lerp(targetPos.current, damp)
    controls.target.lerp(targetLook.current, damp)
    controls.update()

    // Once close enough, stop touching the camera at all — OrbitControls
    // owns it completely from here, so the user's own zoom/pan/orbit is
    // never partially overridden on subsequent frames.
    const arrived = state.camera.position.distanceTo(targetPos.current) < 0.05 && controls.target.distanceTo(targetLook.current) < 0.05
    if (arrived) transitioning.current = false
  })

  const maxReach = Math.max(...SITE_GROUND_HALF) * 1.6

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={maxReach}
      maxPolarAngle={Math.PI * 0.49}
    />
  )
}
