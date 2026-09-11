/**
 * Demo footage shown in each camera's panel.
 *
 * These are stock clips standing in for a CCTV feed — nothing here is a real
 * camera and no video is captured by the app. Every panel that plays one
 * keeps a permanent "SIMULATED FEED" marking over it; that labelling is not
 * decoration, it is what stops a demo being mistaken for live surveillance.
 *
 * Clips live in `public/feeds/` and are served as static files, so they
 * stream by range request rather than being bundled. A camera with no entry
 * here — or whose file is missing — falls back to the text placeholder, so
 * the panel is always correct even with no footage present.
 */

export type CameraFeed = {
  /** Path under public/, or null when no clip is available for this camera. */
  src: string | null
  /** Where the clip came from, shown under the player. */
  credit: string
}

export const CAMERA_FEEDS: Record<string, CameraFeed> = {
  'CAM-01': { src: '/feeds/cam-gate.mp4', credit: 'Stock footage — Pikwizard' },
  'CAM-02': { src: '/feeds/cam-production.mp4', credit: 'Stock footage — Pexels' },
  'CAM-03': { src: '/feeds/cam-warehouse.mp4', credit: 'Stock footage — Pexels' },
  'CAM-04': { src: '/feeds/cam-loading.mp4', credit: 'Stock footage — Pexels' },
  'CAM-05': { src: '/feeds/cam-restricted.mp4', credit: 'Stock footage — iStock (watermarked preview)' },
  'CAM-06': { src: '/feeds/cam-utility.mp4', credit: 'Stock footage — Pexels' },
}

export function cameraFeedFor(cameraId: string): CameraFeed | undefined {
  return CAMERA_FEEDS[cameraId]
}
