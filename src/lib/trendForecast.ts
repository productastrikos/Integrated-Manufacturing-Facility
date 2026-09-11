/**
 * The one place a short-horizon linear forecast is computed — used by
 * `PredictiveTrendChart` to draw the dashed projection and by any page
 * that wants to explain that same forecast in a click-through summary.
 * Sharing this function is what guarantees the two always agree: the
 * chart never shows one number while an explanation quotes another.
 */
export type ForecastResult = {
  forecastValue: number
  trendWord: 'holding steady' | 'trending upward' | 'trending downward'
  confidence: 'High' | 'Moderate' | 'Low'
  volatilityPct: number
  sampleCount: number
  hasEnoughSamples: boolean
}

/** Below this many real points, a fitted line is a coincidence, not a trend — see MIN_FORECAST_SAMPLES in PredictiveTrendChart. */
export const MIN_FORECAST_SAMPLES = 6

export function computeForecast(data: number[], forecastSteps: number, sampleWindow: number): ForecastResult {
  const hasEnoughSamples = data.length >= MIN_FORECAST_SAMPLES
  const recent = data.slice(-sampleWindow)
  const n = recent.length

  if (n === 0) {
    return { forecastValue: 0, trendWord: 'holding steady', confidence: 'Low', volatilityPct: 0, sampleCount: data.length, hasEnoughSamples }
  }

  const xMean = (n - 1) / 2
  const yMean = recent.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (recent[i] - yMean)
    den += (i - xMean) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const forecastValue = yMean + slope * (n - 1 + forecastSteps)

  const residuals = recent.map((v, i) => v - (yMean + slope * (i - xMean)))
  const rmse = Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / n)
  const volatilityPct = yMean !== 0 ? (rmse / Math.abs(yMean)) * 100 : 0
  const rawConfidence: ForecastResult['confidence'] = volatilityPct < 3 ? 'High' : volatilityPct < 10 ? 'Moderate' : 'Low'
  const confidence = n < 10 && rawConfidence === 'High' ? 'Moderate' : rawConfidence
  const trendWord: ForecastResult['trendWord'] =
    Math.abs(slope) < Math.max(Math.abs(yMean) * 0.001, 1e-6) ? 'holding steady' : slope > 0 ? 'trending upward' : 'trending downward'

  return { forecastValue, trendWord, confidence, volatilityPct, sampleCount: data.length, hasEnoughSamples }
}

/** Assembles a `TrendExplainData` object from a chart's own series and computed forecast — see TrendExplainModal.tsx. Kept here so every page builds it the same shape. */
export function buildExplainData(
  label: string,
  unit: string | undefined,
  series: number[],
  forecast: ForecastResult,
  forecastSteps = 6,
  unitLabel = 'm',
  causeText?: string,
) {
  return {
    label,
    unit,
    currentValue: series.at(-1) ?? 0,
    trendWord: forecast.trendWord,
    confidence: forecast.confidence,
    volatilityPct: forecast.volatilityPct,
    forecastValue: forecast.forecastValue,
    forecastSteps,
    unitLabel,
    sampleCount: forecast.sampleCount,
    causeText,
  }
}
