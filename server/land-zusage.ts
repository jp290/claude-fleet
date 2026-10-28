// DIE STEHENDE ZUSAGE DES OWNERS FÜR EIN REPO (Owner 28.10., wörtlich: „[Zitat entfernt]“;
// „[Zitat entfernt]“). EIN Wort je Repo tritt an der Self-Tür an die Stelle eines „[Zitat entfernt]“ auf
// genau dieser Spitze (server/branch-land.ts#landCharge): Ein Sitz landet seinen Branch nach GRÜNEM Merge-Check
// selbst, ohne dass der Owner jeden Stand einzeln ansieht.
//
// Was sie NICHT ersetzt und nicht aufweicht: den grünen Merge-Check (branches.ts#usableCheck), den Audit nach dem
// Land, und die Owner-Tür samt ihren Rechten prüft sie überhaupt nicht. Gesetzt wird sie nur an der Owner-Tür
// (POST /api/branches/zusage), nie mit einem Self-Token. Sie ist standardmäßig AUS, liegt in fleet.json neben
// repoChecks unter dem kanonischen Pfad des Repos und gilt ohne Neustart.
//
// Reine Logik: kein git, keine Datei, kein Server-Zustand. server.ts hält den Stand und persistiert ihn.
export interface LandZusage { at: number }
export type LandZusagen = Readonly<Record<string, LandZusage>>;

// was der Sitz und der Owner sehen: steht das Wort, und seit wann — `on: false` ist der Standard
export interface ZusageView { on: boolean; at: number | null }
export const zusageView = (z: LandZusagen, repo: string): ZusageView => {
  const e = z[repo];
  return e ? { on: true, at: e.at } : { on: false, at: null };
};
export const zusageOn = (z: LandZusagen, repo: string): boolean => z[repo] !== undefined;

// das Wort des Owners: an oder aus. Ein „[Zitat entfernt]“ nimmt den Eintrag ganz aus der Datei, damit „[Zitat entfernt]“ nicht als
// Eintrag mit altem Datum weiterlebt und niemand später rätselt, wann es zuletzt galt.
export function setZusage(z: LandZusagen, repo: string, on: boolean, at: number): LandZusagen {
  const out = { ...z };
  if (on) out[repo] = { at };
  else delete out[repo];
  return out;
}

// fleet.json → Zusagen, jeden Wert neu geprüft; was nicht passt, wird genannt und fallen gelassen
export function readZusagen(raw: unknown): { zusagen: LandZusagen; dropped: string[] } {
  const out: Record<string, LandZusage> = {}, dropped: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { zusagen: out, dropped };
  for (const [repo, v] of Object.entries(raw as Record<string, unknown>)) {
    const at = (v as { at?: unknown } | null)?.at;
    if (!repo.startsWith("/") || typeof at !== "number" || !Number.isFinite(at) || at < 0) { dropped.push(repo); continue; }
    out[repo] = { at };
  }
  return { zusagen: out, dropped };
}
