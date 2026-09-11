export type NavItem = {
  id: string
  path: string
  label: string
  icon: string // SVG path data, 24x24 viewBox, stroke-based line icon
}

export type NavSection = {
  label: string
  items: NavItem[]
}

/** The 13-item main navigation, grouped for the sidebar. Order matches the product spec. */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      {
        id: 'overview',
        path: 'overview',
        label: 'Executive Overview',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      },
      {
        id: 'digital-twin',
        path: 'digital-twin',
        label: 'Digital Twin',
        icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'operations', path: 'operations', label: 'Production & Operations', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
      {
        id: 'materials',
        path: 'materials',
        label: 'Materials & Logistics',
        icon: 'M3 7h11v8H3V7zm11 3h4l3 3v2h-7v-5zM6 19a2 2 0 100-4 2 2 0 000 4zm11 0a2 2 0 100-4 2 2 0 000 4z',
      },
      {
        id: 'bms',
        path: 'bms',
        label: 'Utilities & BMS',
        icon: 'M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M3 21h18M9 8h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1',
      },
    ],
  },
  {
    label: 'Reliability & Quality',
    items: [
      {
        id: 'maintenance',
        path: 'maintenance',
        label: 'Equipment & Maintenance',
        icon: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
      },
      { id: 'quality', path: 'quality', label: 'Quality', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    ],
  },
  {
    label: 'Safety & Security',
    items: [
      {
        id: 'safety-security',
        path: 'safety-security',
        label: 'Safety & Security',
        icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        id: 'simulation',
        path: 'simulation',
        label: 'Simulation',
        icon: 'M12 3v2m0 14v2m9-9h-2M5 12H3m14.66-6.66l-1.42 1.42M7.76 16.24l-1.42 1.42m12.32 0l-1.42-1.42M7.76 7.76L6.34 6.34M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      },
      {
        id: 'work-allocation',
        path: 'work-allocation',
        label: 'Work Allocation',
        icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
      },
    ],
  },
]

/**
 * Sia moved from a sidebar page to a floating chatbot (see `SiaChatPanel`,
 * opened from the header on every page) — no longer a navigable item in
 * the sidebar. The old /app/copilot route still resolves on its own for
 * any existing deep link, it's just not linked from the nav anymore.
 */

/**
 * Routes that still resolve but no longer appear in the sidebar — the
 * standalone Safety and Security pages were merged into one module, and
 * deep links from the Digital Twin, the attention feed and Sia still point
 * at the old paths. They redirect into the merged module on the right tab.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  security: 'safety-security?tab=security',
  safety: 'safety-security?tab=safety',
}

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items)

export type ModuleMeta = { phase: string; scope: string[] }

/** What ships in each deferred module, and when — shown by the honest placeholder screen. */
export const MODULE_META: Record<string, ModuleMeta> = {
  copilot: {
    phase: 'Phase 4',
    scope: [
      'Analyzes the live simulation state — not a generic chatbot',
      'Answers "what requires attention", "why has production decreased", "what is at risk"',
      'Mock AI service now; architected so a real model API can be added without a UI rewrite',
    ],
  },
}
