/**
 * Builds a smooth SVG path through points using quadratic curves drawn
 * through each pair's midpoint — the standard lightweight way to turn a
 * polyline into a natural-looking curve without pulling in a charting
 * library. Falls back to a straight line for very short series.
 */
export function smoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length < 3) {
    return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  }
  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]
    const [nx, ny] = points[i + 1]
    const mx = (x + nx) / 2
    const my = (y + ny) / 2
    d += ` Q${x.toFixed(2)},${y.toFixed(2)} ${mx.toFixed(2)},${my.toFixed(2)}`
  }
  const last = points[points.length - 1]
  d += ` L${last[0].toFixed(2)},${last[1].toFixed(2)}`
  return d
}
