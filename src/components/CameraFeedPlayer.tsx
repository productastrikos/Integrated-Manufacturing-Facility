import { useEffect, useState } from 'react'
import { cameraFeedFor } from '../data/cameraFeeds'

/**
 * The shared CCTV viewer: plays a stock clip standing in for a camera feed,
 * with recorder chrome (id, location, REC indicator, burnt-in clock) and a
 * permanent SIMULATED FEED marking over the picture the whole time it's
 * playing. Used by the Digital Twin's camera panel and the Security
 * module's CCTV grid, so both places show the exact same feed and the same
 * "this isn't real footage" labelling.
 *
 * Falls back to a text placeholder when there's no clip for this camera, it
 * fails to decode, or the camera is offline in the simulation — so the
 * panel is always correct even with no footage present.
 */
export function CameraFeedPlayer({ cameraId, online, location }: { cameraId: string; online: boolean; location: string }) {
  const feed = cameraFeedFor(cameraId)
  const [failed, setFailed] = useState(false)
  const [clock, setClock] = useState(() => new Date())

  // The overlay timestamp ticks like a recorder's burnt-in clock.
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const showVideo = !!feed?.src && !failed && online

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="relative overflow-hidden rounded-sm border"
        style={{ borderColor: 'var(--app-border)', background: 'var(--app-bg)', aspectRatio: '16 / 9' }}
      >
        {showVideo ? (
          <video
            key={feed.src ?? cameraId}
            src={feed.src ?? undefined}
            className="h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-3 text-center">
            <span className="text-[12px] font-semibold" style={{ color: 'var(--app-text-muted)' }}>
              {online ? 'NO DEMO FOOTAGE' : 'CAMERA OFFLINE'}
            </span>
            <span className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
              {online
                ? 'This object represents a camera position in the facility model.'
                : 'This camera is reporting offline in the simulation.'}
            </span>
          </div>
        )}

        {/* recorder chrome — id, location and a burnt-in clock */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-1.5">
          <span className="rounded-sm bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white/90">
            {cameraId} · {location}
          </span>
          {showVideo && (
            <span className="flex items-center gap-1 rounded-sm bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--app-danger)' }} />
              REC
            </span>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-1.5">
          <span className="tnum rounded-sm bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80">
            {clock.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })} {clock.toTimeString().slice(0, 8)}
          </span>
          {/* Never removed while the picture is showing. */}
          <span
            className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
            style={{ background: 'rgba(0,0,0,0.62)', color: 'var(--app-warning)' }}
          >
            SIMULATED FEED
          </span>
        </div>
      </div>

      <p className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
        {showVideo
          ? `Illustrative stock footage, not this facility. No video is captured or streamed by this application. ${feed?.credit ?? ''}`
          : 'No video is captured or streamed by this application.'}
      </p>
    </div>
  )
}
