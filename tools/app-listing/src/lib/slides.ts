/**
 * Slide registry — the single source of truth for the editor sidebar,
 * the /render/[id] pages, and the export pipeline.
 *
 * Each `id` MUST match a file at src/slides/<id>.astro.
 * width/height are the exact output dimensions (Shopify App Store specs).
 */
export interface SlideMeta {
  id: string;
  title: string;
  group: string;
  /** one-line note shown in the editor */
  note: string;
  width: number;
  height: number;
}

export const SLIDES: SlideMeta[] = [
  {
    id: 'feature-image',
    title: 'Feature image',
    group: 'Banner',
    note: 'Top-of-listing brand banner (light) · 1600×900',
    width: 1600,
    height: 900,
  },
  {
    id: 'feature-image-dark',
    title: 'Feature image — dark',
    group: 'Banner',
    note: 'Dark glass variant of the banner · 1600×900',
    width: 1600,
    height: 900,
  },
  {
    id: 'screenshot-01-auto-sort',
    title: '01 · Auto-sort by sales',
    group: 'Screenshots',
    note: 'Best sellers rise to the top automatically',
    width: 1600,
    height: 900,
  },
  {
    id: 'screenshot-02-realtime',
    title: '02 · Real-time rankings',
    group: 'Screenshots',
    note: 'Refreshes as orders land',
    width: 1600,
    height: 900,
  },
  {
    id: 'screenshot-03-soldout',
    title: '03 · Sold-out sinks',
    group: 'Screenshots',
    note: 'Out-of-stock items drop to the bottom',
    width: 1600,
    height: 900,
  },
  {
    id: 'screenshot-04-manual',
    title: '04 · Pin & fine-tune',
    group: 'Screenshots',
    note: 'Manual drag ordering + pinned heroes',
    width: 1600,
    height: 900,
  },
  {
    id: 'screenshot-05-segments',
    title: '05 · Per-collection rules',
    group: 'Screenshots',
    note: 'A different sort for every collection',
    width: 1600,
    height: 900,
  },
];
