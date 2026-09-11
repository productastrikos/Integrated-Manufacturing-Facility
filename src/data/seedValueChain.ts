import type { ValueChainStage } from '../simulation/types'

/**
 * The facility's end-to-end operational stages. Each one names the place in
 * the Digital Twin where the work physically happens, so every stage in the
 * Operations view can take the user to the part of the site that runs it.
 *
 * Deliberately generic manufacturing language — nothing here is specific to
 * one industry.
 */
export const SEED_VALUE_CHAIN: ValueChainStage[] = [
  {
    id: 'procurement',
    name: 'Procurement',
    description: 'Purchase orders raised against suppliers, inbound scheduling and goods receipt into the warehouse.',
    locationLabel: 'Procurement & Receiving Office · Floor 01',
    focusKind: 'room',
    focusId: 'RM-01-PROC',
    status: 'on-track',
    openItems: 14,
    completedToday: 6,
    progressPct: 82,
    progressLabel: 'Orders on schedule',
    metricValue: '3.2 days',
    metricLabel: 'Avg lead time',
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    description: 'Production lines converting received material into finished output across the ground-floor production areas.',
    locationLabel: 'Production Building · Ground Floor',
    focusKind: 'floor',
    focusId: 'FLR-G',
    status: 'on-track',
    openItems: 9,
    completedToday: 21,
    progressPct: 0, // replaced each tick by live OEE
    progressLabel: 'OEE',
    metricValue: '0',
    metricLabel: 'Units today',
  },
  {
    id: 'quality',
    name: 'Quality & Inspection',
    description: 'Measurement, sampling and non-conformance handling before output is released for dispatch.',
    locationLabel: 'Inspection / Quality Area · Ground Floor',
    focusKind: 'area',
    focusId: 'AREA-QA',
    status: 'on-track',
    openItems: 4,
    completedToday: 18,
    progressPct: 0, // replaced each tick by live quality rate
    progressLabel: 'First-pass yield',
    metricValue: '0',
    metricLabel: 'Open NCRs',
  },
  {
    id: 'shipping',
    name: 'Shipping & Dispatch',
    description: 'Finished goods picked, staged and loaded onto outbound vehicles at the dispatch bays.',
    locationLabel: 'Loading / Dispatch Area',
    focusKind: 'building',
    focusId: 'BLD-LOAD',
    status: 'on-track',
    openItems: 7,
    completedToday: 5,
    progressPct: 91,
    progressLabel: 'On-time dispatch',
    metricValue: '0',
    metricLabel: 'Outbound today',
  },
  {
    id: 'installation',
    name: 'Installation & Commissioning',
    description: 'Delivered equipment installed and commissioned on customer sites by the field service teams.',
    locationLabel: 'Commissioning & Test Yard · east of Dispatch',
    focusKind: 'stage',
    focusId: 'installation',
    status: 'attention',
    openItems: 6,
    completedToday: 2,
    progressPct: 68,
    progressLabel: 'Jobs commissioned',
    metricValue: '2 sites',
    metricLabel: 'Awaiting sign-off',
  },
  {
    id: 'construction',
    name: 'Construction & Capital Works',
    description: 'On-site capital projects — plant extensions, utility upgrades and building works in progress.',
    locationLabel: 'Capital Works Site · west expansion plot',
    focusKind: 'stage',
    focusId: 'construction',
    status: 'attention',
    openItems: 3,
    completedToday: 0,
    progressPct: 44,
    progressLabel: 'Capital plan complete',
    metricValue: '3 projects',
    metricLabel: 'Active works',
  },
]
