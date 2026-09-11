import { useCallback, useRef, useState, type ReactNode } from 'react'

/**
 * Shared pointer tracking for the app's charts.
 *
 * Both chart components draw their plot with `preserveAspectRatio="none"`
 * or a fixed viewBox stretched to the card width, so a pointer position
 * cannot be read out of SVG user units directly. Instead the hook measures
 * the rendered element and maps the pointer's horizontal fraction onto a
 * sample index — which stays correct at any card width.
 *
 * Returns the hovered sample index (or null), the 0..1 fraction for
 * positioning a crosshair, and the props to spread onto the plot wrapper.
 */
export function useChartHover(sampleCount: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ index: number; fraction: number } | null>(null)

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current
      if (!el || sampleCount < 2) return
      const rect = el.getBoundingClientRect()
      if (rect.width === 0) return
      const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      setState({ index: Math.round(fraction * (sampleCount - 1)), fraction })
    },
    [sampleCount],
  )

  const onPointerLeave = useCallback(() => setState(null), [])

  return {
    index: state?.index ?? null,
    fraction: state?.fraction ?? null,
    /** Spread onto the element that wraps the plot. */
    bind: { ref, onPointerMove, onPointerLeave },
  }
}

/**
 * A small readout that follows the pointer along a chart. It flips its
 * anchor near the edges so it never spills outside the card.
 */
export function ChartTooltip({ fraction, children }: { fraction: number; children: ReactNode }) {
  // Past ~70% across, anchor the tooltip's right edge to the cursor instead
  // of its centre, otherwise it runs off the end of narrow cards.
  const transform = fraction > 0.7 ? 'translateX(-100%)' : fraction < 0.3 ? 'translateX(0)' : 'translateX(-50%)'

  return (
    <div
      className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded px-2 py-1 text-[10px] leading-tight shadow-lg"
      style={{
        left: `${fraction * 100}%`,
        transform,
        background: 'var(--app-chart-tooltip-bg, var(--app-panel))',
        border: '1px solid var(--app-border)',
        color: 'var(--app-text)',
      }}
    >
      {children}
    </div>
  )
}
