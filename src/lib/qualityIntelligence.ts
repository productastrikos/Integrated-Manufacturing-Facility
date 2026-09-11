import type { ProductionLine, SiteKpis } from '../simulation/types'

/**
 * The single home for every quality formula, so Executive Overview's
 * Quality summary and the Quality module itself can never disagree about
 * the same number — the KPI architecture rule this whole app follows:
 * calculations come from shared state, not independently reinvented per
 * page.
 */
export type QualitySummary = {
  /** Average share of output meeting specification across currently running lines. */
  qualityRatePct: number
  defectRatePct: number
  /** A share of defects are caught and rejected before dispatch, rather than reaching the customer. */
  rejectionRatePct: number
  /** Units produced right the first time, no rework — the OEE quality factor. */
  firstPassYieldPct: number
  /** Lines currently below the 95% quality threshold. */
  nonConformingLines: ProductionLine[]
  runningLines: ProductionLine[]
}

export function summarizeQuality(lines: ProductionLine[], kpis: SiteKpis): QualitySummary {
  const runningLines = lines.filter((l) => l.status === 'running' || l.status === 'warning')
  const qualityRatePct = runningLines.length ? runningLines.reduce((a, l) => a + l.qualityPct, 0) / runningLines.length : 0
  const defectRatePct = 100 - qualityRatePct
  const rejectionRatePct = defectRatePct * 0.6
  const nonConformingLines = runningLines.filter((l) => l.qualityPct < 95)

  return {
    qualityRatePct,
    defectRatePct,
    rejectionRatePct,
    firstPassYieldPct: kpis.oeeQualityPct,
    nonConformingLines,
    runningLines,
  }
}
