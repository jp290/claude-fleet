export const REBUILD_SURFACES = ["renderSlots", "renderBoard", "renderQueue", "renderSuiteMeter"] as const;
export type RebuildSurface = typeof REBUILD_SURFACES[number];
export type RebuildCounts = Record<RebuildSurface, number>;

const rebuilds: RebuildCounts = { renderSlots: 0, renderBoard: 0, renderQueue: 0, renderSuiteMeter: 0 };

export function perfRebuild(surface: RebuildSurface): void {
  rebuilds[surface]++;
}

export function perfRebuilds(): RebuildCounts {
  return { ...rebuilds };
}
